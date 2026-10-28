#!/usr/bin/env bash
# Standalone coverage for arcanum/update/bootstrap.sh's git-path client
# step (issue #870; see docs/agents/architecture/cli-install.md, "Callers"
# -> "`git clone` path").
#
# Builds a local "origin" repo whose every commit holds the repo's real
# bootstrap.sh, tagged:
#   1.0.0  no arcanum/_lib/install_cli.sh
#   2.0.0  a stub arcanum/_lib/install_cli.sh
#   3.0.0  the stub too
# Each case uses a fresh `git clone` of it as TARGET, checked out on the
# start tag, and runs the clone's own bootstrap.sh with
# ARCANUM_ASSUME_YES=1 (no /dev/tty read), ARCANUM_VERSION (no curl) and
# ARCANUM_REPO set.
#
# The stub install_cli.sh appends one record line to $STUB_LOG ($0, its
# arguments, the ARCANUM_CLI_PROMPT it saw and the output of the eval'd
# $STUB_PROBE), echoes a marker on stderr, and exits ${STUB_RC:-0}; on 4 it
# first prints FALLBACK=chat / CLI_VERSION=<v> on stdout. The real
# install_cli.sh outcomes are covered by arcanum/_lib/test_install_cli.sh.
#
# Usage: bash arcanum/update/test_update_bootstrap.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success (or when
# git or jq is missing on the host, with a SKIP message), non-zero with a
# message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_BOOTSTRAP="${SCRIPT_DIR}/bootstrap.sh"
BASH_BIN="${BASH:-$(command -v bash)}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! command -v git >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "SKIP: git and jq are both required on PATH; test_update_bootstrap.sh not run" >&2
  exit 0
fi

TMP_DIR=""
# shellcheck disable=SC2329  # invoked via trap
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(cd -P "$(mktemp -d)" && pwd -P)"
TEST_HOME="${TMP_DIR}/home"
ORIGIN="${TMP_DIR}/origin"
STUB_LOG="${TMP_DIR}/stub-log"
OUT_FILE="${TMP_DIR}/stdout"
ERR_FILE="${TMP_DIR}/stderr"
STUB_MARKER="STUB install_cli.sh called"
mkdir -p "$TEST_HOME"

# Isolate every git call from the host's global/system config (signing,
# hooks, default branch, ...).
export HOME="$TEST_HOME"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null

g() {
  git -c user.name=test -c user.email=test@example.com \
    -c commit.gpgsign=false -c tag.gpgsign=false -c advice.detachedHead=false "$@"
}

# --- Origin repo ------------------------------------------------------------

mkdir -p "${ORIGIN}/arcanum/update"
g -C "$ORIGIN" init -q
cp "$REAL_BOOTSTRAP" "${ORIGIN}/arcanum/update/bootstrap.sh"
echo "1.0.0" > "${ORIGIN}/VERSION"
g -C "$ORIGIN" add -A
g -C "$ORIGIN" commit -qm "1.0.0"
g -C "$ORIGIN" tag 1.0.0

mkdir -p "${ORIGIN}/arcanum/_lib"
cat > "${ORIGIN}/arcanum/_lib/install_cli.sh" <<'STUB'
#!/usr/bin/env bash
probe=""
if [[ -n "${STUB_PROBE:-}" ]]; then
  probe="$(eval "$STUB_PROBE" 2>&1)"
fi
echo "0=$0|args=$*|ARCANUM_CLI_PROMPT=${ARCANUM_CLI_PROMPT-<unset>}|probe=${probe}" >> "$STUB_LOG"
echo "STUB install_cli.sh called" >&2
if [[ "${STUB_RC:-0}" -eq 4 ]]; then
  echo "FALLBACK=chat"
  echo "CLI_VERSION=$1"
fi
exit "${STUB_RC:-0}"
STUB
chmod +x "${ORIGIN}/arcanum/_lib/install_cli.sh"
echo "2.0.0" > "${ORIGIN}/VERSION"
g -C "$ORIGIN" add -A
g -C "$ORIGIN" commit -qm "2.0.0"
g -C "$ORIGIN" tag 2.0.0

echo "3.0.0" > "${ORIGIN}/VERSION"
g -C "$ORIGIN" add -A
g -C "$ORIGIN" commit -qm "3.0.0"
g -C "$ORIGIN" tag 3.0.0

TARGET=""
CASE=""
CASE_N=0
OUT=""
ERR=""
RC=0

# new_case <start tag> — a fresh clone of origin as TARGET, on <start tag>.
new_case() {
  CASE_N=$((CASE_N + 1))
  TARGET="${TMP_DIR}/target-${CASE_N}"
  g clone -q "$ORIGIN" "$TARGET" || fail "clone failed"
  g -C "$TARGET" checkout -q "$1" || fail "checkout $1 failed"
}

# run <case name> <version> [VAR=value ...]
# Runs the clone's bootstrap.sh in a clean env (no inherited ARCANUM_*
# vars), capturing stdout in OUT, stderr in ERR and the exit code in RC.
# The stub probe records the clone's HEAD tag at call time.
run() {
  CASE="$1"
  local version="$2"
  shift 2
  : > "$STUB_LOG"
  env -i HOME="$TEST_HOME" TMPDIR="$TMP_DIR" PATH="$PATH" \
    GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
    ARCANUM_ASSUME_YES=1 ARCANUM_VERSION="$version" ARCANUM_REPO=x/y \
    STUB_LOG="$STUB_LOG" STUB_PROBE="git -C '${TARGET}' describe --tags --exact-match" \
    "$@" "$BASH_BIN" "${TARGET}/arcanum/update/bootstrap.sh" >"$OUT_FILE" 2>"$ERR_FILE"
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

assert_out() {
  [[ "$OUT" == "$1" ]] || fail "[$CASE] expected stdout '$1', got '$OUT'"
}

assert_calls() {
  local n
  n="$(wc -l < "$STUB_LOG" | tr -d ' ')"
  [[ "$n" -eq "$1" ]] || fail "[$CASE] expected $1 stub call(s), got $n: $(cat "$STUB_LOG")"
}

assert_record() {
  grep -qF -- "$1" "$STUB_LOG" || fail "[$CASE] expected stub record to contain '$1', got: $(cat "$STUB_LOG")"
}

assert_head() {
  local tag
  tag="$(git -C "$TARGET" describe --tags --exact-match 2>/dev/null || true)"
  [[ "$tag" == "$1" ]] || fail "[$CASE] expected HEAD at $1, got '${tag}'"
}

# ---------------------------------------------------------------------------
# 1. Called from the checked-out tree, with VERSION, after the checkout.
new_case 1.0.0
run "called from checked-out tree" 2.0.0
assert_rc 0
assert_calls 1
assert_record "0=${TARGET}/arcanum/_lib/install_cli.sh|"
assert_record "|args=2.0.0|"
assert_record "|probe=2.0.0"
assert_err "arcanum updated to 2.0.0 at ${TARGET}"
updated_line="$(grep -n "arcanum updated to" "$ERR_FILE" | head -1 | cut -d: -f1)"
stub_line="$(grep -n "$STUB_MARKER" "$ERR_FILE" | head -1 | cut -d: -f1)"
[[ -n "$stub_line" && "$updated_line" -lt "$stub_line" ]] \
  || fail "[$CASE] 'arcanum updated to' does not precede the client step"
assert_out ""
assert_head 2.0.0

# ---------------------------------------------------------------------------
# 2. A tag without install_cli.sh: skipped silently, exit 0.
new_case 2.0.0
run "old tag without the script" 1.0.0
assert_rc 0
assert_calls 0
assert_out ""
last_line="$(tail -n 1 "$ERR_FILE")"
[[ "$last_line" == "arcanum updated to 1.0.0 at ${TARGET}" ]] \
  || fail "[$CASE] expected stderr to end with the 'arcanum updated to' line, got: $last_line"
[[ "$ERR" != *"arcanum-cli"* ]] || fail "[$CASE] unexpected arcanum-cli output: $ERR"
assert_head 1.0.0

# ---------------------------------------------------------------------------
# 3. Already on the version: no client step.
new_case 2.0.0
run "already on version" 2.0.0
assert_rc 0
assert_err "Already on 2.0.0."
assert_calls 0
assert_out ""

# ---------------------------------------------------------------------------
# 4. Exit 4 is propagated with the stdout keys.
new_case 2.0.0
run "exit 4 propagated" 3.0.0 STUB_RC=4
assert_rc 4
assert_calls 1
assert_out "$(printf 'FALLBACK=chat\nCLI_VERSION=3.0.0')"
assert_head 3.0.0

# ---------------------------------------------------------------------------
# 5. Any other client status is ignored.
new_case 2.0.0
run "other failure ignored" 3.0.0 STUB_RC=1
assert_rc 0
assert_calls 1
assert_out ""
assert_head 3.0.0

# ---------------------------------------------------------------------------
# 6. ARCANUM_CLI_PROMPT reaches the client step unchanged.
new_case 2.0.0
run "prompt flag passed through" 3.0.0 ARCANUM_CLI_PROMPT=chat
assert_rc 0
assert_record "|ARCANUM_CLI_PROMPT=chat|"

echo "ok"
