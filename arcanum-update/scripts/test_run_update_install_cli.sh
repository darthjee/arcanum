#!/usr/bin/env bash
# Standalone coverage for run_update.sh's plain `install-cli <version>`
# subcommand (issue #871): it resumes the client step after the
# /arcanum-update chat answer by running the install's
# arcanum/_lib/install_cli.sh <version> --no-confirm.
#
# Builds a fake install tree in a temp dir: a copy of the real
# run_update.sh at arcanum-update/scripts/run_update.sh, the real
# arcanum/_lib scripts its engine_dispatch.sh source line needs, and a
# stub arcanum/_lib/install_cli.sh that appends one record line ($0 and
# its arguments) to $STUB_LOG and exits ${STUB_RC:-0}. The real
# install_cli.sh outcomes are covered by arcanum/_lib/test_install_cli.sh.
#
# Usage: bash arcanum-update/scripts/test_run_update_install_cli.sh
#        (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success,
# non-zero with a message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_RUN_UPDATE="${SCRIPT_DIR}/run_update.sh"
REAL_LIB_DIR="$(cd "${SCRIPT_DIR}/../../arcanum/_lib" && pwd)"
BASH_BIN="${BASH:-$(command -v bash)}"
LIB_FILES=(
  engine_dispatch.sh
  engine_dispatch_docker.sh
  config_chain.sh
  repo_config.sh
  global_config.sh
  lock.sh
  origin.sh
)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

TMP_DIR=""
# shellcheck disable=SC2329  # invoked via trap
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(cd -P "$(mktemp -d)" && pwd -P)"
INSTALL="${TMP_DIR}/install"
RUN_UPDATE="${INSTALL}/arcanum-update/scripts/run_update.sh"
STUB="${INSTALL}/arcanum/_lib/install_cli.sh"
STUB_LOG="${TMP_DIR}/stub-log"
OUT_FILE="${TMP_DIR}/stdout"
ERR_FILE="${TMP_DIR}/stderr"

mkdir -p "${INSTALL}/arcanum-update/scripts" "${INSTALL}/arcanum/_lib"
cp "$REAL_RUN_UPDATE" "$RUN_UPDATE"
for lib_file in "${LIB_FILES[@]}"; do
  cp "${REAL_LIB_DIR}/${lib_file}" "${INSTALL}/arcanum/_lib/${lib_file}"
done

cat > "$STUB" <<'STUB'
#!/usr/bin/env bash
echo "0=$0|args=$*" >> "$STUB_LOG"
exit "${STUB_RC:-0}"
STUB
chmod +x "$RUN_UPDATE" "$STUB"

CASE=""
OUT=""
ERR=""
RC=0

# run <case name> [VAR=value ...] -- <run_update.sh args...>
# Runs the fake install's run_update.sh in a clean env, capturing stdout
# in OUT, stderr in ERR and the exit code in RC.
run() {
  CASE="$1"
  shift
  local env_vars=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    env_vars+=("$1")
    shift
  done
  [[ $# -gt 0 ]] && shift
  : > "$STUB_LOG"
  env -i HOME="$TMP_DIR" TMPDIR="$TMP_DIR" PATH="$PATH" STUB_LOG="$STUB_LOG" \
    ${env_vars[@]+"${env_vars[@]}"} \
    "$BASH_BIN" "$RUN_UPDATE" "$@" >"$OUT_FILE" 2>"$ERR_FILE"
  RC=$?
  OUT="$(cat "$OUT_FILE")"
  ERR="$(cat "$ERR_FILE")"
}

assert_rc() {
  [[ "$RC" -eq "$1" ]] || fail "[$CASE] expected exit $1, got $RC (stderr: $ERR)"
}

assert_err() {
  [[ "$ERR" == *"$1"* ]] || fail "[$CASE] expected stderr to contain '$1', got: $ERR"
}

assert_calls() {
  local n
  n="$(wc -l < "$STUB_LOG" | tr -d ' ')"
  [[ "$n" -eq "$1" ]] || fail "[$CASE] expected $1 stub call(s), got $n: $(cat "$STUB_LOG")"
}

assert_record() {
  grep -qxF -- "$1" "$STUB_LOG" || fail "[$CASE] expected stub record '$1', got: $(cat "$STUB_LOG")"
}

# ---------------------------------------------------------------------------
# 1. Runs the install's install_cli.sh with the version and --no-confirm.
run "install-cli runs the client step" -- install-cli 1.2.3
assert_rc 0
assert_calls 1
assert_record "0=${STUB}|args=1.2.3 --no-confirm"
[[ -z "$OUT" ]] || fail "[$CASE] expected no stdout, got '$OUT'"

# ---------------------------------------------------------------------------
# 2. install_cli.sh's exit code passes through.
run "exit code passes through" STUB_RC=1 -- install-cli 1.2.3
assert_rc 1
assert_calls 1

# ---------------------------------------------------------------------------
# 3. Missing version: usage, exit 1, no client step.
run "missing version" -- install-cli
assert_rc 1
assert_err "Usage: ${RUN_UPDATE} install-cli <version>"
assert_calls 0

# ---------------------------------------------------------------------------
# 4. Extra argument: usage, exit 1, no client step.
run "extra argument" -- install-cli 1.2.3 extra
assert_rc 1
assert_err "Usage: ${RUN_UPDATE} install-cli <version>"
assert_calls 0

echo "ok"
