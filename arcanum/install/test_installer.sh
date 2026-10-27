#!/usr/bin/env bash
# Standalone coverage for arcanum/install/installer.sh's client step
# (issue #869; spec docs/agents/specs/cli-install/install.md).
#
# Builds a minimal fake release tree in a temp dir (the real installer.sh
# and _lib/install_cli.sh, plus a MANIFEST) and runs that copy, so the
# installer's RELEASE_ROOT is never the repo. Stub `npm` and `node`
# executables go first on a minimal PATH, the same shapes as
# arcanum/_lib/test_install_cli.sh: the stub `npm` records every call and
# whether arcanum.json already existed at its first call; the stub `node`
# fakes `--version` and execs the real `node` for everything else. A
# pass-through stub `jq` can remove the TTY file after the installer's own
# prompts, to give the client step no TTY. The prompts are driven through
# the test-only ARCANUM_TTY_DEVICE seam.
#
# TTY file gotcha: every `read < "$TTY_DEVICE"` in installer.sh reopens a
# regular file and reads its FIRST line. An empty first line therefore
# means "default target" and "Enter" (= yes) at the client prompt, while a
# custom-path first line makes the confirmation read that same non-empty
# line, which aborts the install. install_cli.sh appends its prompt text to
# the TTY file, which lets a case assert the client prompt was asked.
#
# The per-outcome rows of install.md's Outcomes table are covered by
# arcanum/_lib/test_install_cli.sh and are not repeated here.
#
# Usage: bash arcanum/install/test_installer.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success (or when
# node/jq is missing on the host, with a SKIP message), non-zero with a
# message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ARCANUM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BASH_BIN="${BASH:-$(command -v bash)}"
REAL_NODE="$(command -v node || true)"
REAL_JQ="$(command -v jq || true)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if [[ -z "$REAL_NODE" || -z "$REAL_JQ" ]]; then
  echo "SKIP: node and jq are both required on PATH; test_installer.sh not run" >&2
  exit 0
fi

TMP_DIR=""
# shellcheck disable=SC2329  # invoked via trap
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(cd -P "$(mktemp -d)" && pwd -P)"
RELEASE="${TMP_DIR}/release"
INSTALLER="${RELEASE}/arcanum/install/installer.sh"
STUB_BIN="${TMP_DIR}/bin"
PREFIX="${TMP_DIR}/prefix"
CALLS="${TMP_DIR}/npm-calls"
ORDER_FILE="${TMP_DIR}/npm-order"
OUT_FILE="${TMP_DIR}/stdout"
ERR_FILE="${TMP_DIR}/stderr"
TTY_FILE="${TMP_DIR}/tty"
SYS_PATH="/usr/bin:/bin"
V="2.3.0"
NOT_INSTALLED='{"name":"lib"}'
mkdir -p "${RELEASE}/arcanum/install" "${RELEASE}/arcanum/_lib" "$STUB_BIN" "${PREFIX}/bin"

# Fake release tree.
cp "${REPO_ARCANUM_DIR}/install/installer.sh" "${RELEASE}/arcanum/install/installer.sh"
cp "${REPO_ARCANUM_DIR}/_lib/install_cli.sh" "${RELEASE}/arcanum/_lib/install_cli.sh"
chmod +x "${RELEASE}/arcanum/install/installer.sh" "${RELEASE}/arcanum/_lib/install_cli.sh"
printf '%s\n' "arcanum/install/installer.sh" "arcanum/_lib/install_cli.sh" > "${RELEASE}/MANIFEST"

# Stub npm: logs its arguments, records whether the install was complete
# at its first call, answers per subcommand from env.
#   NPM_LS_OUT / NPM_LS_RC     `npm ls`
#   NPM_I_ERR / NPM_I_RC       `npm i` (success creates <prefix>/bin/arcanum)
cat > "${STUB_BIN}/npm" <<'STUB'
#!/usr/bin/env bash
if [[ ! -s "$NPM_STUB_ORDER" ]]; then
  if [[ -f "${HOME}/.claude/skills/arcanum.json" ]]; then
    echo "complete" > "$NPM_STUB_ORDER"
  else
    echo "incomplete" > "$NPM_STUB_ORDER"
  fi
fi
line=""
for arg in "$@"; do line="${line}${arg}|"; done
echo "$line" >> "$NPM_STUB_CALLS"
case "$1" in
  ls)
    printf '%s' "${NPM_LS_OUT:-}"
    exit "${NPM_LS_RC:-0}"
    ;;
  view)
    echo "${2#*@}"
    ;;
  i)
    if [[ "${NPM_I_RC:-0}" -ne 0 ]]; then echo "${NPM_I_ERR:-npm error}" >&2; exit "$NPM_I_RC"; fi
    : > "${NPM_STUB_PREFIX}/bin/arcanum"
    chmod +x "${NPM_STUB_PREFIX}/bin/arcanum"
    echo "added 1 package"
    ;;
  prefix)
    echo "$NPM_STUB_PREFIX"
    ;;
esac
STUB

# Stub node: fakes --version, delegates everything else to the real node.
cat > "${STUB_BIN}/node" <<STUB
#!/usr/bin/env bash
if [[ "\${1:-}" == "--version" ]]; then echo "v22.13.0"; exit 0; fi
exec "${REAL_NODE}" "\$@"
STUB
# Stub jq: optionally removes a file (JQ_STUB_RM), then execs the real jq.
# The installer only calls jq after its own prompts, so removing the TTY
# file here leaves the client step with no TTY.
cat > "${STUB_BIN}/jq" <<STUB
#!/usr/bin/env bash
if [[ -n "\${JQ_STUB_RM:-}" ]]; then rm -f "\$JQ_STUB_RM"; fi
exec "${REAL_JQ}" "\$@"
STUB
chmod +x "${STUB_BIN}/npm" "${STUB_BIN}/node" "${STUB_BIN}/jq"

DEFAULT_PATH="${STUB_BIN}:${PREFIX}/bin:${SYS_PATH}"

OUT=""
ERR=""
RC=0
CASE=""
CASE_HOME=""
CASE_N=0

# new_home — a fresh HOME for the next case, so installs never collide.
new_home() {
  CASE_N=$((CASE_N + 1))
  CASE_HOME="${TMP_DIR}/home-${CASE_N}"
  mkdir -p "$CASE_HOME"
}

# run <case name> [VAR=value ...]
# Runs the fake release's installer.sh in a clean env (no inherited
# ARCANUM_* vars) with HOME=$CASE_HOME, capturing stdout in OUT, stderr in
# ERR and the exit code in RC. The npm call log and order record are reset
# first.
run() {
  CASE="$1"
  shift
  : > "$CALLS"
  : > "$ORDER_FILE"
  env -i HOME="$CASE_HOME" TMPDIR="$TMP_DIR" PATH="$DEFAULT_PATH" \
    REPO=darthjee/arcanum VERSION="$V" \
    NPM_STUB_CALLS="$CALLS" NPM_STUB_ORDER="$ORDER_FILE" NPM_STUB_PREFIX="$PREFIX" \
    NPM_LS_OUT="$NOT_INSTALLED" \
    ARCANUM_TTY_DEVICE="$TTY_FILE" ARCANUM_CLI_TIMEOUT_MS=500 \
    "$@" "$BASH_BIN" "$INSTALLER" >"$OUT_FILE" 2>"$ERR_FILE"
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

assert_no_calls() {
  [[ ! -s "$CALLS" ]] || fail "[$CASE] expected no npm call, got: $(cat "$CALLS")"
}

# assert_installed — the default target holds a complete arcanum install.
assert_installed() {
  local target="${CASE_HOME}/.claude/skills"
  [[ -f "${target}/arcanum.json" ]] || fail "[$CASE] no arcanum.json in ${target}"
  [[ "$(jq -r .version "${target}/arcanum.json")" == "$V" ]] \
    || fail "[$CASE] arcanum.json version mismatch"
  [[ -f "${target}/arcanum/_lib/install_cli.sh" ]] \
    || fail "[$CASE] release tree not copied into ${target}"
}

PROMPT="Install arcanum-cli@${V} globally (npm i -g)? [Y/n]"

# ---------------------------------------------------------------------------
# 1. Ordering / happy path: the client step runs after arcanum.json is written.
new_home
printf '\n' > "$TTY_FILE"
run "ordering"
assert_rc 0
assert_err "arcanum installed to ${CASE_HOME}/.claude/skills"
assert_err "arcanum-cli: arcanum-cli@${V} installed."
installed_line="$(grep -n "arcanum installed to" "$ERR_FILE" | head -1 | cut -d: -f1)"
cli_line="$(grep -n "arcanum-cli: arcanum-cli@${V} installed." "$ERR_FILE" | head -1 | cut -d: -f1)"
[[ "$installed_line" -lt "$cli_line" ]] \
  || fail "[$CASE] 'arcanum installed to' does not precede the client outcome"
[[ "$(cat "$ORDER_FILE")" == "complete" ]] \
  || fail "[$CASE] arcanum.json did not exist at the first npm call"
grep -q "^i|-g|--ignore-scripts|arcanum-cli@${V}|" "$CALLS" \
  || fail "[$CASE] npm i not pinned to VERSION"
assert_out ""
assert_installed

# ---------------------------------------------------------------------------
# 2. ARCANUM_SKIP_CLI skips the client step: no node/npm call, exit 0.
new_home
printf '\n' > "$TTY_FILE"
run "skip cli" ARCANUM_SKIP_CLI=1
assert_rc 0
assert_err "client step skipped (ARCANUM_SKIP_CLI is set)"
assert_no_calls
assert_out ""
assert_installed

# ---------------------------------------------------------------------------
# 3. A client failure still exits 0 with a complete install.
new_home
printf '\n' > "$TTY_FILE"
run "client failure" NPM_I_RC=243 NPM_I_ERR="npm error code EACCES"
assert_rc 0
assert_err "arcanum-cli: warning: npm i -g failed with EACCES"
assert_out ""
assert_installed

# ---------------------------------------------------------------------------
# 4. ARCANUM_ASSUME_YES does not answer the client prompt: it is still asked.
new_home
printf '\n' > "$TTY_FILE"
run "assume yes" ARCANUM_ASSUME_YES=1
assert_rc 0
grep -qF "$PROMPT" "$TTY_FILE" \
  || fail "[$CASE] client prompt not asked on the TTY"
assert_installed

# ---------------------------------------------------------------------------
# 5. An exported ARCANUM_CLI_PROMPT=chat never leaks exit 4 / FALLBACK=chat.
new_home
printf '\n' > "$TTY_FILE"
run "cli prompt chat" ARCANUM_CLI_PROMPT=chat
assert_rc 0
assert_out ""
assert_installed

# The same with no TTY left for the client step, where install_cli.sh
# would exit 4 and print FALLBACK=chat if the variable reached it: the stub
# jq removes the TTY file once the installer's own prompts are read.
new_home
printf '\n' > "$TTY_FILE"
run "cli prompt chat, no TTY" ARCANUM_CLI_PROMPT=chat JQ_STUB_RM="$TTY_FILE"
assert_rc 0
assert_err "arcanum-cli: warning: no TTY to ask for consent, client step skipped"
assert_out ""
assert_no_calls
assert_installed

# ---------------------------------------------------------------------------
# 6. An existing install still exits 1 before the client step.
new_home
mkdir -p "${CASE_HOME}/.claude/skills"
echo '{}' > "${CASE_HOME}/.claude/skills/arcanum.json"
printf '\n' > "$TTY_FILE"
run "existing install"
assert_rc 1
assert_err "Error: an arcanum install already exists at ${CASE_HOME}/.claude/skills."
assert_no_calls
[[ "$(cat "${CASE_HOME}/.claude/skills/arcanum.json")" == "{}" ]] \
  || fail "[$CASE] existing arcanum.json was overwritten"

# ---------------------------------------------------------------------------
# 7. An aborted target confirmation still exits 1 before the client step.
new_home
printf '%s\n' "${TMP_DIR}/custom" > "$TTY_FILE"
run "aborted target"
assert_rc 1
assert_err "Aborted: installation not confirmed."
assert_no_calls
[[ ! -f "${TMP_DIR}/custom/arcanum.json" ]] \
  || fail "[$CASE] arcanum.json written despite the abort"

echo "ok"
