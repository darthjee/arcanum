#!/usr/bin/env bash
# Regression check for issue #453: monitor_pr_shell.sh's raw REST call
# (gh api repos/<repo>/pulls/<pr>/comments) must use the bare owner/repo
# form even under an SSH-proxy-style origin (domain != github.com), never
# the domain-qualified form returned by get_repo_ref. Before the fix, that
# call 404'd under such an origin and the script silently fell back to
# "pending" instead of a genuine no-new-comments result.
#
# Usage: bash auto-monitor-pr/scripts/test_monitor_pr_shell.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success, non-zero
# with a message on stderr on failure. Stubs the `gh` CLI (via a fake
# executable earlier on PATH) so no real network/API calls are made.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_PR_SHELL="${SCRIPT_DIR}/monitor_pr_shell.sh"

FIXTURE_DIR=""
FAKE_BIN_DIR=""
GH_LOG_FILE=""
cleanup() {
  [[ -n "$FIXTURE_DIR" && -d "$FIXTURE_DIR" ]] && rm -rf "$FIXTURE_DIR"
  [[ -n "$FAKE_BIN_DIR" && -d "$FAKE_BIN_DIR" ]] && rm -rf "$FAKE_BIN_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# --- Fixture repo with an SSH-proxy-style origin (this issue's exact
#     reproduction shape: domain 'ssh.github.com' != 'github.com') ---

FIXTURE_DIR="$(mktemp -d)"
git -C "$FIXTURE_DIR" init -q
git -C "$FIXTURE_DIR" remote add origin "ssh://git@ssh.github.com:443/darthjee/arcanum.git"

# --- Fake `gh` CLI, placed earlier on PATH, logging every invocation ---

FAKE_BIN_DIR="$(mktemp -d)"
GH_LOG_FILE="${FAKE_BIN_DIR}/gh_invocations.log"
touch "$GH_LOG_FILE"

cat > "${FAKE_BIN_DIR}/gh" <<EOF
#!/usr/bin/env bash
echo "\$*" >> "${GH_LOG_FILE}"
case "\$1" in
  pr)
    [[ "\$2" == "view" ]] && echo '{"state":"OPEN","comments":[],"reviews":[]}'
    ;;
  api)
    case "\$2" in
      repos/*/pulls/*/comments)
        echo '[]'
        ;;
    esac
    ;;
esac
exit 0
EOF
chmod +x "${FAKE_BIN_DIR}/gh"

# --- Run monitor_pr_shell.sh against the fixture, with the fake gh first
#     on PATH so no real network/API calls are made ---

output=$(PATH="${FAKE_BIN_DIR}:${PATH}" "$MONITOR_PR_SHELL" "$FIXTURE_DIR" --pr-number 452 2>&1)
exit_code=$?

# --- Assertion 1: the script completes successfully with the legitimate
#     "nothing new to report" outcome, not a crash or an early bail-out ---

[[ "$exit_code" -eq 0 ]] || fail "monitor_pr_shell.sh exited $exit_code, expected 0. Output:
$output"

[[ "$output" == "pending" ]] || fail "monitor_pr_shell.sh printed '$output', expected exactly 'pending'"

echo "OK: monitor_pr_shell.sh under an ssh-proxy-style origin prints 'pending' and exits 0"

# --- Assertion 2: the REST call was actually reached, using the BARE
#     owner/repo form (darthjee/arcanum), never the domain-qualified form
#     (ssh.github.com/darthjee/arcanum) that a raw REST path can't resolve ---

grep -qF "api repos/darthjee/arcanum/pulls/452/comments" "$GH_LOG_FILE" || \
  fail "expected fake gh to have been called with 'api repos/darthjee/arcanum/pulls/452/comments' (bare owner/repo); logged invocations:
$(cat "$GH_LOG_FILE")"

if grep -qF "repos/ssh.github.com/darthjee/arcanum/pulls/452/comments" "$GH_LOG_FILE"; then
  fail "gh api REST call used the domain-qualified form (repos/ssh.github.com/darthjee/arcanum/...) instead of the bare owner/repo form; logged invocations:
$(cat "$GH_LOG_FILE")"
fi

echo "OK: gh api repos/.../pulls/.../comments was called with the bare owner/repo form under an ssh-proxy-style origin"

echo "PASS: auto-monitor-pr/scripts/monitor_pr_shell.sh uses the bare repo slug for its REST-path call (issue #453)"
exit 0
