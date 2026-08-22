#!/usr/bin/env bash
# Regression check for issue #111: arcanum/_lib/origin.sh must resolve the target
# GitHub repo from an explicit repo_path argument, never from ambient shell
# cwd. Reproduces the original incident (cwd drifted into an unrelated git
# checkout mid-flow) and asserts the resolver still returns the intended
# repo, plus asserts that calling without a repo_path argument is a hard
# failure rather than a silent cwd fallback.
#
# Usage: bash arcanum/_lib/test_origin_resolution.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success, non-zero
# with a message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCANUM_REPO_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=origin.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/origin.sh"

TMP_DIR=""
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# --- Resolve arcanum's real expected owner/repo, from its actual origin ---

arcanum_origin=$(git -C "$ARCANUM_REPO_PATH" remote get-url origin 2>/dev/null) || \
  fail "could not resolve arcanum's own origin remote to build the expected value"

if [[ "$arcanum_origin" =~ ^git@ ]]; then
  expected_repo_path="${arcanum_origin#*:}"
  expected_repo_path="${expected_repo_path%.git}"
elif [[ "$arcanum_origin" =~ ^https?:// ]]; then
  expected_repo_path="${arcanum_origin#*://*/}"
  expected_repo_path="${expected_repo_path%.git}"
else
  fail "unrecognized origin format for arcanum: $arcanum_origin"
fi

# --- Set up a throwaway repo with a different origin ---

TMP_DIR="$(mktemp -d)"
git -C "$TMP_DIR" init -q
git -C "$TMP_DIR" remote add origin "git@github.com:fake/throwaway.git"

# --- Assertion 1: explicit repo_path resolves the RIGHT repo even when cwd
#     has drifted into the throwaway checkout (the exact incident) ---

resolved=$(
  cd "$TMP_DIR" && get_repo_ref "$ARCANUM_REPO_PATH"
) || fail "get_repo_ref with an explicit repo_path exited non-zero"

if [[ "$resolved" != "$expected_repo_path" ]]; then
  fail "get_repo_ref resolved '$resolved' instead of expected '$expected_repo_path' — ambient cwd (throwaway repo) leaked into resolution"
fi

if [[ "$resolved" == "fake/throwaway" ]]; then
  fail "get_repo_ref resolved the throwaway repo's origin instead of the explicitly-passed arcanum repo_path"
fi

echo "OK: get_repo_ref('$ARCANUM_REPO_PATH') resolved '$resolved' from within an unrelated cwd ($TMP_DIR)"

# --- Assertion 2: calling with NO repo_path argument is a hard failure,
#     not a silent fallback to ambient cwd ---

if (
    cd "$TMP_DIR" && get_repo_ref
  ) 2>/dev/null; then
  fail "get_repo_ref with no arguments succeeded — ambient-cwd fallback is not structurally blocked"
fi

echo "OK: get_repo_ref with no repo_path argument hard-fails (no ambient-cwd fallback)"

echo "PASS: arcanum/_lib/origin.sh resolves the explicitly-passed repo_path, ignoring ambient shell cwd"

# --- Assertion 3 (issue #237): an ssh:// origin (as seen on CircleCI, whose
#     git config rewrites https:// origins to ssh://) resolves to the same
#     domain/repo as the equivalent https:// and git@ SCP-like forms ---

HTTPS_DIR="$(mktemp -d)"
git -C "$HTTPS_DIR" init -q
git -C "$HTTPS_DIR" remote add origin "https://github.com/darthjee/arcanum.git"

SCP_DIR="$(mktemp -d)"
git -C "$SCP_DIR" init -q
git -C "$SCP_DIR" remote add origin "git@github.com:darthjee/arcanum.git"

SSH_DIR="$(mktemp -d)"
git -C "$SSH_DIR" init -q
git -C "$SSH_DIR" remote add origin "ssh://git@github.com/darthjee/arcanum.git"

https_domain=$(get_domain "$HTTPS_DIR") || fail "get_domain failed for https:// origin"
https_repo=$(get_repo_path "$HTTPS_DIR") || fail "get_repo_path failed for https:// origin"

scp_domain=$(get_domain "$SCP_DIR") || fail "get_domain failed for git@ (SCP-like) origin"
scp_repo=$(get_repo_path "$SCP_DIR") || fail "get_repo_path failed for git@ (SCP-like) origin"

ssh_domain=$(get_domain "$SSH_DIR") || fail "get_domain failed for ssh:// origin"
ssh_repo=$(get_repo_path "$SSH_DIR") || fail "get_repo_path failed for ssh:// origin"

rm -rf "$HTTPS_DIR" "$SCP_DIR" "$SSH_DIR"

[[ "$ssh_domain" == "github.com" ]] || fail "ssh:// origin resolved domain '$ssh_domain', expected 'github.com'"
[[ "$ssh_repo" == "darthjee/arcanum" ]] || fail "ssh:// origin resolved repo_path '$ssh_repo', expected 'darthjee/arcanum'"

[[ "$ssh_domain" == "$https_domain" && "$ssh_domain" == "$scp_domain" ]] || \
  fail "ssh:// domain '$ssh_domain' does not match https:// domain '$https_domain' / git@ domain '$scp_domain'"

[[ "$ssh_repo" == "$https_repo" && "$ssh_repo" == "$scp_repo" ]] || \
  fail "ssh:// repo_path '$ssh_repo' does not match https:// repo_path '$https_repo' / git@ repo_path '$scp_repo'"

echo "OK: ssh://git@github.com/darthjee/arcanum.git resolves to the same domain/repo as the https:// and git@ forms"

echo "PASS: arcanum/_lib/origin.sh parses ssh:// origins (issue #237 — CircleCI's insteadOf URL rewrite)"
exit 0
