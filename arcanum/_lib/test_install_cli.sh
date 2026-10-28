#!/usr/bin/env bash
# Standalone coverage for arcanum/_lib/install_cli.sh — the shared
# arcanum-cli client step (issue #868; see
# docs/agents/architecture/cli-install.md).
#
# Stub `npm` and `node` executables go first on a minimal PATH. The stub
# `npm` records every call (one argument per `|`-separated field) and
# answers from env-configured canned output; the stub `node` fakes
# `--version` and execs the real `node` for everything else, so the
# `node -e` detection wrapper really runs. The TTY is driven through the
# test-only ARCANUM_TTY_DEVICE seam (a nonexistent path for "no TTY", a
# regular file holding the answers otherwise), and the npm timeouts are
# shortened through ARCANUM_CLI_TIMEOUT_MS.
#
# Usage: bash arcanum/_lib/test_install_cli.sh  (no arguments)
# Standalone — not wired into any skill's flow, same convention as
# arcanum/_lib/test_lock.sh. Exit 0 on success, non-zero with a message on
# stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${SCRIPT_DIR}/install_cli.sh"
CLI_PACKAGE_JSON="${SCRIPT_DIR}/../../cli/package.json"
BASH_BIN="${BASH:-$(command -v bash)}"
REAL_NODE="$(command -v node || true)"

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
STUB_BIN="${TMP_DIR}/bin"
NO_NODE_BIN="${TMP_DIR}/bin-no-node"
PREFIX="${TMP_DIR}/prefix"
CALLS="${TMP_DIR}/npm-calls"
ERR_FILE="${TMP_DIR}/stderr"
TTY_FILE="${TMP_DIR}/tty"
NO_TTY="${TMP_DIR}/no-such-tty"
SYS_PATH="/usr/bin:/bin"
mkdir -p "$STUB_BIN" "$NO_NODE_BIN" "${PREFIX}/bin"

# Stub npm: logs its arguments, answers per subcommand from env.
#   NPM_LS_OUT / NPM_LS_RC / NPM_LS_SLEEP   `npm ls`
#   NPM_VIEW_OUT (default: the requested version) / NPM_VIEW_ERR / NPM_VIEW_RC
#   NPM_I_ERR / NPM_I_RC                    `npm i` (success creates
#                                           <prefix>/bin/arcanum)
#   NPM_STUB_PREFIX                         `npm prefix -g`
cat > "${STUB_BIN}/npm" <<'STUB'
#!/usr/bin/env bash
line=""
for arg in "$@"; do line="${line}${arg}|"; done
echo "$line" >> "$NPM_STUB_CALLS"
case "$1" in
  ls)
    if [[ -n "${NPM_LS_SLEEP:-}" ]]; then exec sleep "$NPM_LS_SLEEP"; fi
    printf '%s' "${NPM_LS_OUT:-}"
    exit "${NPM_LS_RC:-0}"
    ;;
  view)
    if [[ -n "${NPM_VIEW_ERR:-}" ]]; then echo "$NPM_VIEW_ERR" >&2; fi
    if [[ "${NPM_VIEW_RC:-0}" -ne 0 ]]; then exit "$NPM_VIEW_RC"; fi
    if [[ -n "${NPM_VIEW_OUT+set}" ]]; then printf '%s' "$NPM_VIEW_OUT"; else echo "${2#*@}"; fi
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
cp "${STUB_BIN}/npm" "${NO_NODE_BIN}/npm"

# Stub node: fakes --version, delegates everything else to the real node.
cat > "${STUB_BIN}/node" <<STUB
#!/usr/bin/env bash
if [[ "\${1:-}" == "--version" ]]; then echo "\${NODE_STUB_VERSION:-v22.13.0}"; exit 0; fi
exec "${REAL_NODE:-/nonexistent-node}" "\$@"
STUB
chmod +x "${STUB_BIN}/npm" "${NO_NODE_BIN}/npm" "${STUB_BIN}/node"

# The installed client's binary, on PATH by default (no PATH warning).
: > "${PREFIX}/bin/arcanum"
chmod +x "${PREFIX}/bin/arcanum"
DEFAULT_PATH="${STUB_BIN}:${PREFIX}/bin:${SYS_PATH}"

OUT=""
ERR=""
RC=0
CASE=""

# run <case name> [VAR=value ...] -- <script args...>
# Runs the script in a clean env (no inherited ARCANUM_* vars), capturing
# stdout in OUT, stderr in ERR and the exit code in RC. The npm call log is
# reset first.
run() {
  CASE="$1"
  shift
  local envs=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    envs[${#envs[@]}]="$1"
    shift
  done
  [[ $# -gt 0 ]] && shift
  : > "$CALLS"
  OUT="$(env -i HOME="$TMP_DIR" TMPDIR="$TMP_DIR" PATH="$DEFAULT_PATH" \
    NPM_STUB_CALLS="$CALLS" NPM_STUB_PREFIX="$PREFIX" \
    ARCANUM_TTY_DEVICE="$NO_TTY" ARCANUM_CLI_TIMEOUT_MS=500 \
    ${envs[@]+"${envs[@]}"} "$BASH_BIN" "$SCRIPT" "$@" 2>"$ERR_FILE")"
  RC=$?
  ERR="$(cat "$ERR_FILE")"
}

assert_rc() {
  [[ "$RC" -eq "$1" ]] || fail "[$CASE] expected exit $1, got $RC (stderr: $ERR)"
}

assert_err() {
  [[ "$ERR" == *"$1"* ]] || fail "[$CASE] expected stderr to contain '$1', got: $ERR"
}

assert_err_not() {
  [[ "$ERR" != *"$1"* ]] || fail "[$CASE] expected stderr not to contain '$1', got: $ERR"
}

assert_out() {
  [[ "$OUT" == "$1" ]] || fail "[$CASE] expected stdout '$1', got '$OUT'"
}

# assert_calls <expected subcommands, space-separated, e.g. "ls view i">
assert_calls() {
  local actual
  actual="$(cut -d'|' -f1 < "$CALLS" | tr '\n' ' ' | sed 's/ $//')"
  [[ "$actual" == "$1" ]] || fail "[$CASE] expected npm calls '$1', got '$actual'"
}

# Every stderr line must carry the prefix (npm's own passthrough aside).
assert_prefixed() {
  local line
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == "arcanum-cli: "* || "$line" == "added 1 package" || "$line" == npm\ * ]] \
      || fail "[$CASE] unprefixed stderr line: $line"
  done <<< "$ERR"
}

V="2.3.0"
INSTALLED_OLDER='{"dependencies":{"arcanum-cli":{"version":"2.2.3"}}}'
INSTALLED_SAME='{"dependencies":{"arcanum-cli":{"version":"2.3.0"}}}'
INSTALLED_NEWER='{"dependencies":{"arcanum-cli":{"version":"2.4.0"}}}'
NOT_INSTALLED='{"name":"lib"}'

# ---------------------------------------------------------------------------
# Usage errors.
run "usage: missing version" --
assert_rc 1
run "usage: extra argument" -- "$V" extra
assert_rc 1
run "usage: unknown flag" -- "$V" --yes
assert_rc 1
run "usage: only the flag" -- --no-confirm
assert_rc 1
assert_calls ""

# ---------------------------------------------------------------------------
# Paths that never call npm (nor need node).
run "skipped by env" ARCANUM_SKIP_CLI=1 ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: client step skipped (ARCANUM_SKIP_CLI is set)"
assert_out ""
assert_calls ""

for bad in "2.3" "v2.3.0" "02.3.0" "2.3.0+build" "2.3.0-" "2.3.0-rc..1" "latest" "^2.3.0"; do
  run "invalid version $bad" -- "$bad" --no-confirm
  assert_rc 0
  assert_err "arcanum-cli: warning: '$bad' is not a plain semver version"
  assert_err "Install it manually with: npm i -g arcanum-cli"
  assert_calls ""
done

run "no TTY" NPM_LS_OUT="$NOT_INSTALLED" -- "$V"
assert_rc 0
assert_err "arcanum-cli: warning: no TTY to ask for consent, client step skipped. Install it manually with: npm i -g arcanum-cli@${V}"
assert_out ""
assert_calls ""

run "no node or npm" PATH="${NO_NODE_BIN}:${SYS_PATH}" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: node or npm is not on PATH"
assert_calls ""

run "no npm" PATH="${TMP_DIR}/none:${SYS_PATH}" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: node or npm is not on PATH"

run "node too old" NODE_STUB_VERSION=v22.12.9 -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: Node 22.12.9 found, 22.13.0 or later required"
assert_err "npm i -g arcanum-cli@${V}"
assert_calls ""

run "node much older" NODE_STUB_VERSION=v18.20.0 -- "$V" --no-confirm
assert_rc 0
assert_err "Node 18.20.0 found"

if [[ -z "$REAL_NODE" ]]; then
  echo "SKIP: no real node on PATH; detection-dependent cases not run" >&2
  echo "ok (partial: no node)"
  exit 0
fi

# ---------------------------------------------------------------------------
# install.md's Outcomes.
printf '\n' > "$TTY_FILE"
run "installed (TTY, Enter)" NPM_LS_OUT="$NOT_INSTALLED" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "arcanum-cli: arcanum-cli@${V} installed."
assert_err_not "warning"
assert_out ""
assert_calls "ls view i prefix"
grep -q "Install arcanum-cli@${V} globally (npm i -g)? \[Y/n\] " "$TTY_FILE" \
  || fail "[$CASE] install prompt not written to the TTY"
grep -qx "i|-g|--ignore-scripts|arcanum-cli@${V}|" "$CALLS" \
  || fail "[$CASE] npm i not called with --ignore-scripts and one pinned argument"
grep -qx "view|arcanum-cli@${V}|version|--fetch-retries=0|--fetch-timeout=500|" "$CALLS" \
  || fail "[$CASE] npm view not bounded"
grep -qx "ls|-g|--json|--depth=0|arcanum-cli|" "$CALLS" \
  || fail "[$CASE] npm ls call mismatch"
assert_prefixed

for yes in "y" "Y" "yes" "YES"; do
  printf '%s\n' "$yes" > "$TTY_FILE"
  run "installed (answer $yes)" NPM_LS_OUT="$NOT_INSTALLED" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
  assert_rc 0
  assert_err "arcanum-cli@${V} installed."
done

printf 'maybe\ny\n' > "$TTY_FILE"
run "re-asks on an invalid answer" NPM_LS_OUT="$NOT_INSTALLED" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "arcanum-cli@${V} installed."
[[ "$(grep -o 'Install arcanum-cli' "$TTY_FILE" | wc -l | tr -d ' ')" == "2" ]] \
  || fail "[$CASE] expected the prompt twice"

for no in "n" "N" "no" "No"; do
  printf '%s\n' "$no" > "$TTY_FILE"
  run "declined ($no)" NPM_LS_OUT="$NOT_INSTALLED" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
  assert_rc 0
  assert_err "arcanum-cli: skipped by user. Install it manually with: npm i -g arcanum-cli@${V}"
  assert_err_not "warning"
  assert_calls "ls view"
done

: > "$TTY_FILE"
run "TTY closed before an answer" NPM_LS_OUT="$NOT_INSTALLED" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "skipped by user"
assert_calls "ls view"

printf '\n' > "$TTY_FILE"
run "ARCANUM_ASSUME_YES does not answer the prompt (no TTY)" ARCANUM_ASSUME_YES=1 NPM_LS_OUT="$NOT_INSTALLED" -- "$V"
assert_rc 0
assert_err "no TTY to ask for consent"
assert_calls ""
printf 'n\n' > "$TTY_FILE"
run "ARCANUM_ASSUME_YES does not answer the prompt (TTY)" ARCANUM_ASSUME_YES=1 NPM_LS_OUT="$NOT_INSTALLED" \
  ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "skipped by user"
grep -q "Install arcanum-cli@${V} globally" "$TTY_FILE" || fail "[$CASE] prompt not asked"
assert_calls "ls view"

run "--no-confirm with no TTY installs" NPM_LS_OUT="$NOT_INSTALLED" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli@${V} installed."
assert_calls "ls view i prefix"

run "--no-confirm before the version" NPM_LS_OUT="$NOT_INSTALLED" -- --no-confirm "$V"
assert_rc 0
assert_err "arcanum-cli@${V} installed."

run "prerelease target" NPM_LS_OUT="$NOT_INSTALLED" -- "2.3.0-rc.1" --no-confirm
assert_rc 0
assert_err "arcanum-cli@2.3.0-rc.1 installed."
grep -qx "i|-g|--ignore-scripts|arcanum-cli@2.3.0-rc.1|" "$CALLS" || fail "[$CASE] npm i mismatch"

run "unpublished (E404)" NPM_LS_OUT="$NOT_INSTALLED" NPM_VIEW_RC=1 \
  NPM_VIEW_ERR="npm error code E404" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: arcanum-cli@${V} is not published on npm, client step skipped. Install it manually with: npm i -g arcanum-cli"
assert_err_not "npm i -g arcanum-cli@"
assert_calls "ls view"

run "unpublished (empty output)" NPM_LS_OUT="$NOT_INSTALLED" NPM_VIEW_OUT="" -- "$V" --no-confirm
assert_rc 0
assert_err "is not published on npm"
assert_calls "ls view"

run "network error (npm view)" NPM_LS_OUT="$NOT_INSTALLED" NPM_VIEW_RC=1 \
  NPM_VIEW_ERR="npm error code ETIMEDOUT" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: could not reach the npm registry (network error: ETIMEDOUT), client step skipped. Install it manually with: npm i -g arcanum-cli@${V}"
assert_calls "ls view"

run "network error (npm view, no code)" NPM_LS_OUT="$NOT_INSTALLED" NPM_VIEW_RC=1 -- "$V" --no-confirm
assert_rc 0
assert_err "could not reach the npm registry (network error)"

run "EACCES" NPM_LS_OUT="$NOT_INSTALLED" NPM_I_RC=243 \
  NPM_I_ERR="npm error code EACCES" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: npm i -g failed with EACCES"
assert_err "fix the prefix"
assert_err "Install it manually with: npm i -g arcanum-cli@${V}"
assert_err_not "sudo"
assert_calls "ls view i"

run "network error (npm i)" NPM_LS_OUT="$NOT_INSTALLED" NPM_I_RC=1 \
  NPM_I_ERR="npm error code ECONNRESET" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: npm i -g failed (ECONNRESET)"
assert_calls "ls view i"

# ---------------------------------------------------------------------------
# already-installed.md's Outcomes and Edge cases.
printf 'y\n' > "$TTY_FILE"
run "updated" NPM_LS_OUT="$INSTALLED_OLDER" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "arcanum-cli: arcanum-cli updated 2.2.3 → ${V}."
assert_calls "ls view i prefix"
grep -q "Update arcanum-cli 2.2.3 → ${V} (npm i -g)? \[Y/n\] " "$TTY_FILE" \
  || fail "[$CASE] update prompt not written to the TTY"

printf 'n\n' > "$TTY_FILE"
run "declined update" NPM_LS_OUT="$INSTALLED_OLDER" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "skipped by user. Install it manually with: npm i -g arcanum-cli@${V}"
assert_calls "ls view"

run "update failed (EEXIST)" NPM_LS_OUT="$INSTALLED_OLDER" NPM_I_RC=1 \
  NPM_I_ERR="npm error code EEXIST" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: npm i -g failed with EEXIST (another package owns the arcanum binary)"
assert_err "Install it manually with: npm i -g arcanum-cli@${V}"
assert_calls "ls view i"
if grep -q -- "--force" "$CALLS"; then fail "[$CASE] --force passed"; fi

run "unchanged" NPM_LS_OUT="$INSTALLED_SAME" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: arcanum-cli@${V} is already up to date."
assert_calls "ls prefix"

run "unchanged, with a TTY" NPM_LS_OUT="$INSTALLED_SAME" ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_err "already up to date"
assert_calls "ls prefix"

run "newer kept" NPM_LS_OUT="$INSTALLED_NEWER" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: arcanum-cli@2.4.0 is newer than ${V}; left as is. Downgrade with: npm i -g --ignore-scripts arcanum-cli@${V}"
assert_err_not "warning"
assert_calls "ls prefix"

run "--no-confirm never downgrades" NPM_LS_OUT="$INSTALLED_NEWER" -- "$V" --no-confirm
assert_rc 0
if grep -q "^i|" "$CALLS"; then fail "[$CASE] npm i called on a newer client"; fi

run "prerelease target, release installed" NPM_LS_OUT="$INSTALLED_SAME" -- "2.3.0-rc.1" --no-confirm
assert_rc 0
assert_err "arcanum-cli@2.3.0 is newer than 2.3.0-rc.1"
assert_calls "ls prefix"

run "linked (link: true)" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"1.0.0","link":true}}}' -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: arcanum-cli is linked (npm link); left as is."
assert_calls "ls"

run "linked (resolved file:)" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"9.0.0","resolved":"file:/home/dev/arcanum/cli"}}}' \
  -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: arcanum-cli is linked from /home/dev/arcanum/cli; left as is."
assert_calls "ls"

run "unknown (no output)" NPM_LS_OUT="" NPM_LS_RC=1 -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli: warning: could not read the installed arcanum-cli version (npm ls printed nothing), client step skipped. Install it manually with: npm i -g arcanum-cli@${V}"
assert_calls "ls"

run "unknown (invalid JSON)" NPM_LS_OUT="npm ERR! oops" -- "$V" --no-confirm
assert_rc 0
assert_err "(npm ls printed invalid JSON)"
assert_calls "ls"

run "unknown (entry without version)" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"invalid":true}}}' -- "$V" --no-confirm
assert_rc 0
assert_err "(npm ls reported arcanum-cli without a version)"
assert_calls "ls"

run "unknown (missing: true)" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"2.2.0","missing":true}}}' -- "$V" --no-confirm
assert_rc 0
assert_err "without a version"
assert_calls "ls"

run "unknown (unparseable installed version)" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"next"}}}' -- "$V" --no-confirm
assert_rc 0
assert_err "installed version next is not plain semver"
assert_calls "ls"

run "unknown (npm ls timeout)" NPM_LS_SLEEP=5 -- "$V" --no-confirm
assert_rc 0
assert_err "(npm ls timed out)"
assert_calls "ls"

run "invalid-flagged entry with a readable version" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"2.2.3","invalid":true,"extraneous":true}}}' \
  NPM_LS_RC=1 -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli updated 2.2.3 → ${V}."
assert_calls "ls view i prefix"

# ---------------------------------------------------------------------------
# Opt-in chat fallback (ARCANUM_CLI_PROMPT=chat, no TTY).
run "chat: missing" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$NOT_INSTALLED" -- "$V"
assert_rc 4
assert_out "FALLBACK=chat
CLI_VERSION=${V}"
assert_calls "ls view"

run "chat: older" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$INSTALLED_OLDER" -- "$V"
assert_rc 4
assert_out "FALLBACK=chat
CLI_VERSION=${V}
CLI_INSTALLED=2.2.3"
assert_calls "ls view"

for state in "$INSTALLED_SAME" "$INSTALLED_NEWER" \
  '{"dependencies":{"arcanum-cli":{"version":"1.0.0","link":true}}}' "garbage"; do
  run "chat: no question for $state" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$state" -- "$V"
  assert_rc 0
  assert_out ""
done

run "chat: unpublished exits 0" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$NOT_INSTALLED" NPM_VIEW_OUT="" -- "$V"
assert_rc 0
assert_out ""

printf 'y\n' > "$TTY_FILE"
run "chat with a TTY prompts on the TTY" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$NOT_INSTALLED" \
  ARCANUM_TTY_DEVICE="$TTY_FILE" -- "$V"
assert_rc 0
assert_out ""
assert_err "arcanum-cli@${V} installed."

run "other ARCANUM_CLI_PROMPT value keeps the no-TTY skip" ARCANUM_CLI_PROMPT=yes NPM_LS_OUT="$NOT_INSTALLED" -- "$V"
assert_rc 0
assert_out ""
assert_err "no TTY to ask for consent"
assert_calls ""

run "chat + --no-confirm installs" ARCANUM_CLI_PROMPT=chat NPM_LS_OUT="$NOT_INSTALLED" -- "$V" --no-confirm
assert_rc 0
assert_out ""
assert_err "arcanum-cli@${V} installed."

# ---------------------------------------------------------------------------
# PATH check.
OTHER_BIN="${TMP_DIR}/other-bin"
mkdir -p "$OTHER_BIN"
: > "${OTHER_BIN}/arcanum"
chmod +x "${OTHER_BIN}/arcanum"
run "PATH: foreign arcanum first" PATH="${STUB_BIN}:${OTHER_BIN}:${PREFIX}/bin:${SYS_PATH}" \
  NPM_LS_OUT="$NOT_INSTALLED" -- "$V" --no-confirm
assert_rc 0
assert_err "arcanum-cli@${V} installed."
assert_err "arcanum-cli: warning: arcanum on PATH is ${OTHER_BIN}/arcanum, not the client at ${PREFIX}/bin/arcanum; reorder PATH or remove the other one."
assert_err_not "Install it manually"

run "PATH: prefix bin not on PATH" PATH="${STUB_BIN}:${SYS_PATH}" NPM_LS_OUT="$INSTALLED_SAME" -- "$V" --no-confirm
assert_rc 0
assert_err "already up to date"
assert_err "arcanum-cli: warning: the client is at ${PREFIX}/bin/arcanum, but ${PREFIX}/bin is not on PATH."

run "PATH: newer kept also checks PATH" PATH="${STUB_BIN}:${SYS_PATH}" NPM_LS_OUT="$INSTALLED_NEWER" -- "$V" --no-confirm
assert_rc 0
assert_err "is not on PATH."

ln -s "${PREFIX}/bin" "${TMP_DIR}/linked-bin"
run "PATH: symlinked entry to the prefix bin" PATH="${STUB_BIN}:${TMP_DIR}/linked-bin:${SYS_PATH}" \
  NPM_LS_OUT="$INSTALLED_SAME" -- "$V" --no-confirm
assert_rc 0
assert_err_not "warning"

run "PATH: no check on linked" PATH="${STUB_BIN}:${SYS_PATH}" \
  NPM_LS_OUT='{"dependencies":{"arcanum-cli":{"version":"1.0.0","link":true}}}' -- "$V" --no-confirm
assert_rc 0
assert_err_not "warning"
assert_calls "ls"

run "PATH: no check on failure" PATH="${STUB_BIN}:${SYS_PATH}" NPM_LS_OUT="$NOT_INSTALLED" \
  NPM_I_RC=1 -- "$V" --no-confirm
assert_rc 0
assert_err_not "is not on PATH"
assert_calls "ls view i"

# ---------------------------------------------------------------------------
# Semver comparison, table-driven through the wrapper. Each row:
# "<installed> <op> <target>" with op one of < = >.
# `<` -> older (exit 4 under the chat fallback), `=` -> same, `>` -> newer.
SEMVER_TABLE=(
  "2.2.3 < 2.3.0"
  "2.3.0-rc.1 < 2.3.0"
  "2.3.0 > 2.3.0-rc.1"
  "1.0.0-alpha < 1.0.0-alpha.1"
  "1.0.0-alpha.1 < 1.0.0-alpha.beta"
  "1.0.0-alpha.beta < 1.0.0-beta"
  "1.0.0-beta < 1.0.0-beta.2"
  "1.0.0-beta.2 < 1.0.0-beta.11"
  "1.0.0-beta.11 < 1.0.0-rc.1"
  "1.0.0-rc.1 < 1.0.0"
  "1.0.0-beta.11 > 1.0.0-beta.2"
  "1.0.0-alpha.beta > 1.0.0-alpha.1"
  "10.0.0 > 9.9.9"
  "9.9.9 < 10.0.0"
  "1.10.0 > 1.9.0"
  "1.0.10 > 1.0.9"
  "1.0.0+build.5 = 1.0.0"
  "1.0.0-rc.1+build = 1.0.0-rc.1"
  "2.3.0 = 2.3.0"
)
i=0
while (( i < ${#SEMVER_TABLE[@]} )); do
  read -r installed op target <<< "${SEMVER_TABLE[i]}"
  run "semver: ${SEMVER_TABLE[i]}" ARCANUM_CLI_PROMPT=chat \
    NPM_LS_OUT="{\"dependencies\":{\"arcanum-cli\":{\"version\":\"${installed}\"}}}" -- "$target"
  case "$op" in
    "<")
      assert_rc 4
      assert_out "FALLBACK=chat
CLI_VERSION=${target}
CLI_INSTALLED=${installed}"
      ;;
    "=")
      assert_rc 0
      assert_err "is already up to date"
      ;;
    ">")
      assert_rc 0
      assert_err "arcanum-cli@${installed} is newer than ${target}"
      ;;
  esac
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Node-floor drift: the script's constant must match cli/package.json.
SCRIPT_FLOOR="$(sed -n 's/^CLI_NODE_FLOOR="\(.*\)"$/\1/p' "$SCRIPT")"
[[ -n "$SCRIPT_FLOOR" ]] || fail "CLI_NODE_FLOOR not found in $SCRIPT"
if [[ -f "$CLI_PACKAGE_JSON" ]]; then
  ENGINES_NODE="$("$REAL_NODE" -p 'require(process.argv[1]).engines.node' "$CLI_PACKAGE_JSON")"
  [[ "$ENGINES_NODE" == ">=${SCRIPT_FLOOR}" ]] \
    || fail "node floor drift: cli/package.json engines.node is '${ENGINES_NODE}', install_cli.sh has '${SCRIPT_FLOOR}'"
else
  echo "SKIP: ${CLI_PACKAGE_JSON} not found; node-floor drift check not run" >&2
fi

echo "ok"
exit 0
