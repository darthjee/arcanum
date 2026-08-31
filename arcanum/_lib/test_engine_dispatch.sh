#!/usr/bin/env bash
# Standalone coverage for arcanum/_lib/engine_dispatch.sh — the shell/
# native/docker dispatch guard (issue #192, see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/192-.../plan.md for the full design/shared
# contracts this exercises).
#
# Usage: bash arcanum/_lib/test_engine_dispatch.sh  (no arguments)
# Standalone — not wired into any skill's flow, same convention as
# arcanum/_lib/test_origin_resolution.sh. Exit 0 on success, non-zero
# with a message on stderr on failure.
#
# Cases 1 & 2 (shell-mode and native-available parity) are anchored on
# the real, already-migrated "auto-fix-all-config-get" command (shell
# twin: auto-fix-all/scripts/config_get_shell.sh) — see
# docs/agents/plans/340-.../plan.md's "Shared contracts".
#
# NOTE: case 4 below ("native crash") still invokes core/bin/arcanum's
# "dispatch-fixture-crash" command (out of scope for #340, tracked by
# #342). If that command isn't routed yet, that assertion will fail with
# a clear message rather than silently passing — re-run this script once
# core/bin/arcanum routes it.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_SCRIPT="${SCRIPT_DIR}/../../auto-fix-all/scripts/config_get_shell.sh"
FIXTURE_KEY="auto_merge"
EXPECTED_OUTPUT="true"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

TMP_DIR=""
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(mktemp -d)"
REPO_DIR="${TMP_DIR}/repo"
mkdir -p "${REPO_DIR}/.claude/state" "${REPO_DIR}/.claude/configuration"

# The shell twin (config_get_shell.sh) enters the repo via
# arcanum/_lib/repo_path.sh's repo_path_enter, which requires a real git
# repository — unlike the retired dispatch-fixture, which was
# context: 'none' and needed no such thing.
git -C "$REPO_DIR" init -q

jq -n --arg key "$FIXTURE_KEY" '{"auto-fix-all": {($key): true}}' \
  > "${REPO_DIR}/.claude/configuration/arcanum-repo-config.json"

# Isolate the global config tier too, so a real developer machine's own
# ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json (which may set
# engine.mode) can never leak into this test's assertions.
CLAUDE_CONFIG_DIR="${TMP_DIR}/global-config"
export CLAUDE_CONFIG_DIR
mkdir -p "$CLAUDE_CONFIG_DIR"

set_engine_mode() {
  local mode="$1"
  jq -n --arg mode "$mode" '{"engine": {"mode": $mode}}' \
    > "${REPO_DIR}/.claude/state/arcanum-config.json"
}

# --- Case 1: engine.mode=shell -> always runs the shell fixture,
#     regardless of what migration-status.json says for
#     auto-fix-all-config-get (it says `true`) ---

set_engine_mode "shell"

out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case1.stderr")
code=$?

[[ $code -eq 0 ]] || fail "case 1 (engine.mode=shell): expected exit 0, got $code"
[[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "case 1 (engine.mode=shell): expected stdout '${EXPECTED_OUTPUT}', got '${out}'"
[[ -s "${TMP_DIR}/case1.stderr" ]] && fail "case 1 (engine.mode=shell): expected no stderr, got: $(cat "${TMP_DIR}/case1.stderr")"

echo "OK: engine.mode=shell runs the shell fixture directly"

# --- Case 2: engine.mode=native, migration-status.json says
#     auto-fix-all-config-get:true -> runs the NATIVE path (core/bin/
#     arcanum auto-fix-all-config-get); stdout/exit code must byte-match
#     the shell fixture's (the parity assertion — the shared contract
#     with node) ---

set_engine_mode "native"

shell_out=$(bash "$FIXTURE_SCRIPT" "$REPO_DIR" "$FIXTURE_KEY")
shell_code=$?

native_out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case2.stderr")
native_code=$?

if [[ $native_code -ne 0 || "$native_out" != "$shell_out" || $native_code -ne $shell_code ]]; then
  fail "case 2 (engine.mode=native, available): native path did not byte-match the shell fixture — shell: (exit $shell_code) '${shell_out}'; native: (exit $native_code) '${native_out}'. If core/bin/arcanum's auto-fix-all-config-get routing has regressed, re-run this script once it's fixed."
fi
[[ -s "${TMP_DIR}/case2.stderr" ]] && fail "case 2 (engine.mode=native, available): expected no stderr, got: $(cat "${TMP_DIR}/case2.stderr")"

echo "OK: engine.mode=native with an available native implementation matches the shell fixture byte-for-byte"

# --- Case 3: engine.mode=native, migration-status.json has NO entry for
#     the command -> falls back to shell, with a warning on stderr ---

out=$(engine_dispatch "$REPO_DIR" "dispatch-fixture-not-a-real-command" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case3.stderr")
code=$?

[[ $code -eq 0 ]] || fail "case 3 (native, unavailable): expected exit 0 (fallback), got $code"
[[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "case 3 (native, unavailable): expected fallback stdout '${EXPECTED_OUTPUT}', got '${out}'"
[[ -s "${TMP_DIR}/case3.stderr" ]] || fail "case 3 (native, unavailable): expected a fallback warning on stderr, got none"

echo "OK: engine.mode=native with no migration-status.json entry falls back to shell, with a stderr warning"

# --- Case 4: engine.mode=native, migration-status.json says
#     dispatch-fixture-crash:true -> native path invoked and it crashes
#     -> dispatcher fails loud, no fallback to the shell fixture's
#     output (dispatch-fixture-crash itself is out of scope for #340,
#     tracked by #342 — only the shared $FIXTURE_SCRIPT/$REPO_DIR it
#     reuses from cases 1/2 changed above) ---

out=$(engine_dispatch "$REPO_DIR" "dispatch-fixture-crash" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case4.stderr")
code=$?

[[ $code -ne 0 ]] || fail "case 4 (native crash): expected a non-zero exit propagated from the native crash, got 0. If core/bin/arcanum's dispatch-fixture-crash routing hasn't landed yet, re-run this script once it has."
[[ "$out" != "$EXPECTED_OUTPUT" ]] || fail "case 4 (native crash): dispatcher silently fell back to the shell fixture's output instead of propagating the crash"

echo "OK: engine.mode=native with a crashing native implementation fails loud, without falling back to shell"

echo "PASS: arcanum/_lib/engine_dispatch.sh — shell/native/docker dispatch guard behaves per docs/agents/architecture/script-engine.md"
exit 0
