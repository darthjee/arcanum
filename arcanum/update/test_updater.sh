#!/usr/bin/env bash
# Standalone coverage for arcanum/update/updater.sh's client step (zip
# path; issue #870; spec docs/agents/specs/cli-install/update.md).
#
# Each case builds a FRESH fake release tree in a temp dir (updater.sh's
# cleanup trap deletes its own release root): the repo's real updater.sh,
# a stub arcanum/_lib/install_cli.sh and a MANIFEST listing both. It also
# builds a TARGET whose arcanum.json is at an older version, then runs
# the release's updater.sh with TARGET/REPO/VERSION exported, so there is
# no /dev/tty read.
#
# The stub install_cli.sh appends one record line to $STUB_LOG ($0, its
# arguments, the ARCANUM_CLI_PROMPT it saw and the output of the eval'd
# $STUB_PROBE), echoes a marker on stderr, and exits ${STUB_RC:-0}; on 4 it
# first prints FALLBACK=chat / CLI_VERSION=<v> on stdout. The real
# install_cli.sh outcomes are covered by arcanum/_lib/test_install_cli.sh.
#
# Usage: bash arcanum/update/test_updater.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success (or when
# jq is missing on the host, with a SKIP message), non-zero with a message
# on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_UPDATER="${SCRIPT_DIR}/updater.sh"
BASH_BIN="${BASH:-$(command -v bash)}"
REAL_JQ="$(command -v jq || true)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if [[ -z "$REAL_JQ" ]]; then
  echo "SKIP: jq is required on PATH; test_updater.sh not run" >&2
  exit 0
fi

TMP_DIR=""
# shellcheck disable=SC2329  # invoked via trap
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(cd -P "$(mktemp -d)" && pwd -P)"
STUB_SRC="${TMP_DIR}/stub_install_cli.sh"
STUB_LOG="${TMP_DIR}/stub-log"
OUT_FILE="${TMP_DIR}/stdout"
ERR_FILE="${TMP_DIR}/stderr"
OLD_V="1.0.0"
V="2.0.0"
STUB_MARKER="STUB install_cli.sh called"

cat > "$STUB_SRC" <<'STUB'
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
chmod +x "$STUB_SRC"

RELEASE=""
TARGET=""
CASE=""
CASE_N=0
OUT=""
ERR=""
RC=0

# new_case <arcanum.json version> — a fresh release tree and TARGET.
new_case() {
  CASE_N=$((CASE_N + 1))
  RELEASE="${TMP_DIR}/release-${CASE_N}"
  TARGET="${TMP_DIR}/target-${CASE_N}"
  mkdir -p "${RELEASE}/arcanum/update" "${RELEASE}/arcanum/_lib" "$TARGET"
  cp "$REAL_UPDATER" "${RELEASE}/arcanum/update/updater.sh"
  cp "$STUB_SRC" "${RELEASE}/arcanum/_lib/install_cli.sh"
  chmod +x "${RELEASE}/arcanum/update/updater.sh" "${RELEASE}/arcanum/_lib/install_cli.sh"
  printf '%s\n' "arcanum/update/updater.sh" "arcanum/_lib/install_cli.sh" > "${RELEASE}/MANIFEST"
  printf '{"version":"%s","repo":"x/y","manifest":[]}\n' "$1" > "${TARGET}/arcanum.json"
}

# run <case name> [VAR=value ...]
# Runs the case's release updater.sh in a clean env (no inherited
# ARCANUM_* vars), capturing stdout in OUT, stderr in ERR and the exit code
# in RC. The stub probe records arcanum.json's version and whether the
# release tree still exists.
run() {
  CASE="$1"
  shift
  : > "$STUB_LOG"
  local probe
  probe="printf '%s,%s' \"\$(jq -r .version '${TARGET}/arcanum.json')\" \"\$([[ -d '${RELEASE}' ]] && echo release || echo no-release)\""
  env -i HOME="$TMP_DIR" TMPDIR="$TMP_DIR" PATH="$PATH" \
    TARGET="$TARGET" REPO=x/y VERSION="$V" \
    STUB_LOG="$STUB_LOG" STUB_PROBE="$probe" \
    "$@" "$BASH_BIN" "${RELEASE}/arcanum/update/updater.sh" >"$OUT_FILE" 2>"$ERR_FILE"
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

assert_version() {
  [[ "$(jq -r .version "${TARGET}/arcanum.json")" == "$1" ]] \
    || fail "[$CASE] expected arcanum.json at $1, got $(jq -r .version "${TARGET}/arcanum.json")"
}

# ---------------------------------------------------------------------------
# 1. Order and path: one call, from the installed copy, with VERSION, after
#    arcanum.json is written and after the "arcanum updated to" line.
new_case "$OLD_V"
run "order and path"
assert_rc 0
assert_calls 1
assert_record "0=${TARGET}/arcanum/_lib/install_cli.sh|"
assert_record "|args=${V}|"
assert_record "|probe=${V},release"
assert_err "arcanum updated to ${V} at ${TARGET}"
updated_line="$(grep -n "arcanum updated to" "$ERR_FILE" | head -1 | cut -d: -f1)"
stub_line="$(grep -n "$STUB_MARKER" "$ERR_FILE" | head -1 | cut -d: -f1)"
[[ -n "$stub_line" && "$updated_line" -lt "$stub_line" ]] \
  || fail "[$CASE] 'arcanum updated to' does not precede the client step"
assert_out ""
assert_version "$V"
[[ ! -d "$RELEASE" ]] || fail "[$CASE] release tree not removed"
[[ ! -d "${TARGET}/.arcanum-update.lock" ]] || fail "[$CASE] lock not removed"

# ---------------------------------------------------------------------------
# 2. Already on the version: no client step.
new_case "$V"
run "already on version"
assert_rc 0
assert_err "Already on ${V}."
assert_calls 0
assert_out ""

# ---------------------------------------------------------------------------
# 3. Exit 4 is propagated with the stdout keys; cleanup still runs.
new_case "$OLD_V"
run "exit 4 propagated" STUB_RC=4
assert_rc 4
assert_calls 1
assert_out "$(printf 'FALLBACK=chat\nCLI_VERSION=%s' "$V")"
[[ ! -d "$RELEASE" ]] || fail "[$CASE] release tree not removed"
[[ ! -d "${TARGET}/.arcanum-update.lock" ]] || fail "[$CASE] lock not removed"
assert_version "$V"

# ---------------------------------------------------------------------------
# 4. Any other client status is ignored.
new_case "$OLD_V"
run "other failure ignored" STUB_RC=1
assert_rc 0
assert_calls 1
assert_out ""
assert_version "$V"

# ---------------------------------------------------------------------------
# 5. ARCANUM_CLI_PROMPT reaches the client step unchanged (and is unset when
#    the caller does not set it).
new_case "$OLD_V"
run "prompt flag passed through" ARCANUM_CLI_PROMPT=chat
assert_rc 0
assert_record "|ARCANUM_CLI_PROMPT=chat|"

new_case "$OLD_V"
run "prompt flag unset"
assert_rc 0
assert_record "|ARCANUM_CLI_PROMPT=<unset>|"

echo "ok"
