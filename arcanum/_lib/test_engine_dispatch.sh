#!/usr/bin/env bash
# Standalone coverage for arcanum/_lib/engine_dispatch.sh — the shell/
# native/docker dispatch guard (issues #192 and #729, see
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
#     auto-fix-all-config-get (it says `"native"`) ---

set_engine_mode "shell"

out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case1.stderr")
code=$?

[[ $code -eq 0 ]] || fail "case 1 (engine.mode=shell): expected exit 0, got $code"
[[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "case 1 (engine.mode=shell): expected stdout '${EXPECTED_OUTPUT}', got '${out}'"
[[ -s "${TMP_DIR}/case1.stderr" ]] && fail "case 1 (engine.mode=shell): expected no stderr, got: $(cat "${TMP_DIR}/case1.stderr")"

echo "OK: engine.mode=shell runs the shell fixture directly"

# --- Case 2: engine.mode=native, migration-status.json says
#     auto-fix-all-config-get:"native" -> runs the NATIVE path (core/bin/
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
#     dispatch-fixture-crash:"native" -> native path invoked and it crashes
#     -> dispatcher fails loud, no fallback to the shell fixture's
#     output (dispatch-fixture-crash itself is out of scope for #340,
#     tracked by #342 — only the shared $FIXTURE_SCRIPT/$REPO_DIR it
#     reuses from cases 1/2 changed above) ---

out=$(engine_dispatch "$REPO_DIR" "dispatch-fixture-crash" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case4.stderr")
code=$?

[[ $code -ne 0 ]] || fail "case 4 (native crash): expected a non-zero exit propagated from the native crash, got 0. If core/bin/arcanum's dispatch-fixture-crash routing hasn't landed yet, re-run this script once it has."
[[ "$out" != "$EXPECTED_OUTPUT" ]] || fail "case 4 (native crash): dispatcher silently fell back to the shell fixture's output instead of propagating the crash"

echo "OK: engine.mode=native with a crashing native implementation fails loud, without falling back to shell"

# --- Cases 5-9: --native-only (issue #680). <shell_script> is "" and
#     must never run; migration-status.json is never consulted. Anchored
#     on auto-fix-all-config-get, same as cases 1/2. ---

run_native_only() {
  local label="$1"
  shift
  out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "" --native-only -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/${label}.stderr")
  code=$?
  [[ $code -eq 0 ]] || fail "${label}: expected exit 0 from the native path, got $code (stderr: $(cat "${TMP_DIR}/${label}.stderr"))"
  [[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "${label}: expected native stdout '${EXPECTED_OUTPUT}', got '${out}'"
  [[ -s "${TMP_DIR}/${label}.stderr" ]] && fail "${label}: expected no stderr, got: $(cat "${TMP_DIR}/${label}.stderr")"
  return 0
}

rm -f "${REPO_DIR}/.claude/state/arcanum-config.json"
run_native_only "case5-unset"
echo "OK: --native-only with engine.mode unset runs native"

set_engine_mode "shell"
run_native_only "case6-shell"
echo "OK: --native-only with engine.mode=shell runs native"

set_engine_mode "native"
run_native_only "case7-native"
echo "OK: --native-only with engine.mode=native runs native"

# Case 8: engine.mode=docker, --native-only. The real map says
# `"native"` (not docker-ready) for auto-fix-all-config-get, so this
# runs native on the host with the row-3 warning — no hard error, and
# no docker call.
set_engine_mode "docker"
out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "" --native-only -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/case8.stderr")
code=$?
expected_err="Warning: 'auto-fix-all-config-get' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host."
[[ $code -eq 0 ]] || fail "case 8 (--native-only, docker): expected exit 0, got $code"
[[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "case 8 (--native-only, docker): expected native stdout '${EXPECTED_OUTPUT}', got '${out}'"
[[ "$(cat "${TMP_DIR}/case8.stderr")" == "$expected_err" ]] || fail "case 8 (--native-only, docker): expected stderr '${expected_err}', got '$(cat "${TMP_DIR}/case8.stderr")'"
echo "OK: --native-only with engine.mode=docker and a not-docker-ready status runs native on the host, with the row-3 warning"

# Case 9: point the lib at temporary maps that mark the command `shell`
# (no native implementation), a legacy `false`, then omit it entirely.
# Under engine.mode=native, --native-only never consults the map, so it
# must still run native, with no fallback warning.
set_engine_mode "native"
REAL_MIGRATION_STATUS_FILE="$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="${TMP_DIR}/migration-status.json"
echo '{"auto-fix-all-config-get": "shell"}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_native_only "case9-map-shell"
echo '{"auto-fix-all-config-get": false}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_native_only "case9-map-false"
echo '{}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_native_only "case9-map-absent"
echo "OK: --native-only ignores migration-status.json"

# --- Case 10: engine.mode=native, dual entrypoint, driven by temporary
#     maps. Status `shell` -> shell fallback with the warning; status
#     `host-only` -> native (only `shell` falls back); legacy booleans
#     are tolerated (`false` -> shell fallback with the warning, `true`
#     -> native). ---

expected_warn="Warning: no native implementation of 'auto-fix-all-config-get' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation."

run_dual() {
  local label="$1" expect="$2"
  out=$(engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "$FIXTURE_SCRIPT" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/${label}.stderr")
  code=$?
  [[ $code -eq 0 ]] || fail "${label}: expected exit 0, got $code (stderr: $(cat "${TMP_DIR}/${label}.stderr"))"
  [[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "${label}: expected stdout '${EXPECTED_OUTPUT}', got '${out}'"
  if [[ "$expect" == "fallback" ]]; then
    [[ "$(cat "${TMP_DIR}/${label}.stderr")" == "$expected_warn" ]] || fail "${label}: expected stderr '${expected_warn}', got '$(cat "${TMP_DIR}/${label}.stderr")'"
  else
    [[ -s "${TMP_DIR}/${label}.stderr" ]] && fail "${label}: expected no stderr (native path), got: $(cat "${TMP_DIR}/${label}.stderr")"
  fi
  return 0
}

echo '{"auto-fix-all-config-get": "shell"}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_dual "case10-enum-shell" "fallback"
echo '{"auto-fix-all-config-get": "host-only"}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_dual "case10-enum-host-only" "native"
echo '{"auto-fix-all-config-get": false}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_dual "case10-legacy-false" "fallback"
echo '{"auto-fix-all-config-get": true}' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
run_dual "case10-legacy-true" "native"
echo "OK: engine.mode=native follows the status enum (only \`shell\` falls back) and tolerates legacy booleans"

# --- Case 11: _engine_dispatch_status reading rule, called directly for
#     every map state and both <native_only> values. ---

assert_status() {
  local key="$1" native_only="$2" expected="$3" label="$4"
  local actual
  actual=$(_engine_dispatch_status "$key" "$native_only") || fail "case 11 (${label}, native_only=${native_only}): expected exit 0"
  [[ "$actual" == "$expected" ]] || fail "case 11 (${label}, native_only=${native_only}): expected '${expected}', got '${actual}'"
  return 0
}

cat > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE" <<'JSON'
{
  "k-shell": "shell",
  "k-native": "native",
  "k-docker": "docker",
  "k-host-only": "host-only",
  "k-true": true,
  "k-false": false,
  "k-unknown": "weird",
  "k-number": 3,
  "k-null": null,
  "k-object": {}
}
JSON

#            key          dual         native-only
for row in \
  "k-shell     shell      native" \
  "k-native    native     native" \
  "k-docker    docker     docker" \
  "k-host-only host-only  host-only" \
  "k-true      native     native" \
  "k-false     shell      native" \
  "k-unknown   shell      native" \
  "k-number    shell      native" \
  "k-null      shell      native" \
  "k-object    shell      native" \
  "k-missing   shell      native"; do
  read -r key dual native_only_expected <<< "$row"
  assert_status "$key" false "$dual" "$key"
  assert_status "$key" true "$native_only_expected" "$key"
done

echo '{bad json' > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
assert_status "k-native" false shell "malformed file"
assert_status "k-native" true native "malformed file"

_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="${TMP_DIR}/does-not-exist.json"
assert_status "k-native" false shell "missing file"
assert_status "k-native" true native "missing file"

_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$REAL_MIGRATION_STATUS_FILE"
echo "OK: _engine_dispatch_status follows the reading rule for every map state"

# --- Case 12: engine.mode=docker, driven by temporary maps — the
#     resolution rows that need no Docker daemon. `native` -> row-3
#     warning + native; `shell` -> row-3b warning + shell; `docker` with
#     no `docker` on PATH -> row-4 `docker not found` warning + native
#     (for a dual and a native-only entrypoint); `host-only` -> native,
#     no warning. ---

set_engine_mode "docker"
_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="${TMP_DIR}/migration-status.json"

# A PATH with every executable the host has, except `docker`.
NO_DOCKER_BIN="${TMP_DIR}/no-docker-bin"
mkdir -p "$NO_DOCKER_BIN"
IFS=':' read -r -a path_dirs <<< "$PATH"
for dir in "${path_dirs[@]}"; do
  [[ -d "$dir" ]] || continue
  for exe in "$dir"/*; do
    name="$(basename "$exe")"
    [[ "$name" == "docker" || -e "${NO_DOCKER_BIN}/${name}" ]] && continue
    [[ -f "$exe" && -x "$exe" ]] && ln -s "$exe" "${NO_DOCKER_BIN}/${name}"
  done
done

row3="Warning: 'auto-fix-all-config-get' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host."
row3b="$expected_warn"
row4="Warning: Docker is unavailable (docker not found) — running 'auto-fix-all-config-get' natively on the host. Fix Docker or change engine.mode."

run_docker_mode() {
  local label="$1" status="$2" expected_stderr="$3" path="$4"
  shift 4
  echo "{\"auto-fix-all-config-get\": \"${status}\"}" > "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE"
  out=$(PATH="$path" engine_dispatch "$REPO_DIR" "auto-fix-all-config-get" "$@" -- "$REPO_DIR" "$FIXTURE_KEY" 2>"${TMP_DIR}/${label}.stderr")
  code=$?
  [[ $code -eq 0 ]] || fail "${label}: expected exit 0, got $code (stderr: $(cat "${TMP_DIR}/${label}.stderr"))"
  [[ "$out" == "$EXPECTED_OUTPUT" ]] || fail "${label}: expected stdout '${EXPECTED_OUTPUT}', got '${out}'"
  [[ "$(cat "${TMP_DIR}/${label}.stderr")" == "$expected_stderr" ]] || fail "${label}: expected stderr '${expected_stderr}', got '$(cat "${TMP_DIR}/${label}.stderr")'"
  return 0
}

run_docker_mode "case12-native" native "$row3" "$PATH" "$FIXTURE_SCRIPT"
run_docker_mode "case12-shell" shell "$row3b" "$PATH" "$FIXTURE_SCRIPT"
run_docker_mode "case12-host-only" host-only "" "$PATH" "$FIXTURE_SCRIPT"
run_docker_mode "case12-no-docker" docker "$row4" "$NO_DOCKER_BIN" "$FIXTURE_SCRIPT" --needs=gh --path-arg=1:ro
run_docker_mode "case12-no-docker-native-only" docker "$row4" "$NO_DOCKER_BIN" "" --native-only

_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$REAL_MIGRATION_STATUS_FILE"
echo "OK: engine.mode=docker follows the resolution order (rows 2, 3, 3b and 4) without a Docker daemon"

echo "PASS: arcanum/_lib/engine_dispatch.sh — shell/native/docker dispatch guard behaves per docs/agents/architecture/script-engine.md"
exit 0
