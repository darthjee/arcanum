#!/usr/bin/env bash
# Shared client step: installs or updates the `arcanum-cli` npm package
# globally, pinned to the arcanum version being installed. Called by the
# installer, the updater (zip and git paths), `/arcanum-update`'s
# `install-cli` resume and the global migration, so they all follow the
# same rules. Source of truth: docs/agents/specs/cli-install.md and its
# parts (cli-install/install.md, already-installed.md, update.md).
#
# Plain bash on purpose: no engine_dispatch shim, no `_shell.sh` twin, no
# native command. It runs from installer.sh / bootstrap.sh outside any
# configured repo and must use the host's `npm` (see
# docs/agents/architecture/script-engine.md).
#
# Usage:
#   install_cli.sh <version> [--no-confirm]
#
#   <version>      target arcanum-cli version, plain semver
#                  MAJOR.MINOR.PATCH[-prerelease]; validated before any
#                  `npm` call.
#   --no-confirm   pre-answers the [Y/n] prompt (consent is only ever an
#                  argument). It never downgrades, leaves a linked client
#                  alone and skips an unreadable one. /dev/tty is never
#                  opened with it.
#
# Order of checks:
#   1. ARCANUM_SKIP_CLI set              -> info, skip (no node/npm call)
#   2. <version> not plain semver        -> warning, skip (no npm call)
#   3. no TTY (unless --no-confirm or ARCANUM_CLI_PROMPT=chat)
#                                        -> warning, skip (no npm call)
#   4. node/npm missing, Node < floor    -> warning, skip
#   5. `npm ls -g --json --depth=0 arcanum-cli` (node -e wrapper):
#      same/newer/linked -> info, done; unknown -> warning, done;
#      older/missing -> continue
#   6. `npm view arcanum-cli@<v> version` (bounded) -> unpublished or
#      network error: warning, skip
#   7. [Y/n] prompt on the TTY (skipped by --no-confirm); no TTY and
#      ARCANUM_CLI_PROMPT=chat -> exit 4 with the stdout keys below
#   8. `npm i -g --ignore-scripts "arcanum-cli@<v>"` (never sudo, never
#      --force, never a retry)
#   9. PATH check: `arcanum` on PATH vs `$(npm prefix -g)/bin`
#
# Output:
#   Every user-facing line goes to stderr, prefixed `arcanum-cli:`.
#   stdout is empty, except on exit 4:
#     FALLBACK=chat
#     CLI_VERSION=<v>
#     CLI_INSTALLED=<v>   (only when a client is already installed)
#
# Exit codes:
#   0  every outcome (installed, updated, unchanged, skipped, declined,
#      failed with a warning)
#   1  usage error (missing or extra arguments, unknown flag)
#   4  opt-in chat fallback (no TTY and ARCANUM_CLI_PROMPT=chat, and an
#      install or update would happen)
#
# Environment:
#   ARCANUM_SKIP_CLI          any non-empty value skips the step.
#   ARCANUM_CLI_PROMPT        exactly `chat`: with no TTY, exit 4 instead of
#                             the no-TTY skip. Only asks, never consents.
#   ARCANUM_TTY_DEVICE        TEST-ONLY override of the TTY device path
#                             (defaults to /dev/tty), as in
#                             next_step_prompt_shell.sh.
#   ARCANUM_CLI_TIMEOUT_MS    TEST-ONLY override of the `npm ls` / `npm view`
#                             timeout in milliseconds (defaults to 15000).
#   ARCANUM_ASSUME_YES is never read: it does not answer the client prompt.

set -euo pipefail

# Minimum Node version the CLI supports. Mirrors cli/package.json's
# engines.node (cli/ is not in the release zip, so it cannot be read at
# install time); test_install_cli.sh fails on drift.
CLI_NODE_FLOOR="22.13.0"
CLI_PACKAGE="arcanum-cli"

# Test-only overrides (see header); not user-facing settings.
TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"
CLI_TIMEOUT_MS="${ARCANUM_CLI_TIMEOUT_MS:-15000}"

_usage_error() {
  echo "Error: $1" >&2
  echo "Usage: $0 <version> [--no-confirm]" >&2
  exit 1
}

VERSION=""
NO_CONFIRM=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-confirm)
      NO_CONFIRM=1
      ;;
    -*)
      _usage_error "unknown option: $1"
      ;;
    *)
      [[ -z "$VERSION" ]] || _usage_error "unexpected argument: $1"
      VERSION="$1"
      ;;
  esac
  shift
done
[[ -n "$VERSION" ]] || _usage_error "missing <version>"

# Manual command named by warnings; overridable per outcome (unpublished
# version, downgrade hint).
MANUAL_CMD="npm i -g ${CLI_PACKAGE}@${VERSION}"

# _info <msg> — informational line on stderr.
_info() {
  echo "arcanum-cli: $1" >&2
}

# _warn <reason> [manual command] — warning line on stderr, naming the
# manual command (defaults to MANUAL_CMD).
_warn() {
  echo "arcanum-cli: warning: $1. Install it manually with: ${2:-$MANUAL_CMD}" >&2
}

# 1. Opt-out by env: no node/npm call.
if [[ -n "${ARCANUM_SKIP_CLI:-}" ]]; then
  _info "client step skipped (ARCANUM_SKIP_CLI is set)"
  exit 0
fi

# 2. Plain semver only: MAJOR.MINOR.PATCH[-prerelease], no build metadata.
_SEMVER_NUM='(0|[1-9][0-9]*)'
_SEMVER_ID='[0-9A-Za-z-]+'
_SEMVER_RE="^${_SEMVER_NUM}\\.${_SEMVER_NUM}\\.${_SEMVER_NUM}(-${_SEMVER_ID}(\\.${_SEMVER_ID})*)?\$"
if [[ ! "$VERSION" =~ $_SEMVER_RE ]]; then
  _warn "'${VERSION}' is not a plain semver version, client step skipped" "npm i -g ${CLI_PACKAGE}"
  exit 0
fi

# _tty_available — true when the TTY device can be opened for reading.
_tty_available() {
  ( exec 3< "$TTY_DEVICE" ) 2>/dev/null
}

# 3. TTY check, only probed when it is needed: --no-confirm needs no
# prompt, and ARCANUM_CLI_PROMPT=chat turns a missing TTY into exit 4 at
# the prompt step.
PROMPT_CHAT=0
[[ "${ARCANUM_CLI_PROMPT:-}" == "chat" ]] && PROMPT_CHAT=1
if [[ "$NO_CONFIRM" -eq 0 && "$PROMPT_CHAT" -eq 0 ]]; then
  if ! _tty_available; then
    _warn "no TTY to ask for consent, client step skipped"
    exit 0
  fi
fi

# 4. Node and npm present, Node at least the floor.
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  _warn "node or npm is not on PATH, client step skipped"
  exit 0
fi

# _version_ge <a> <b> — true when numeric MAJOR.MINOR.PATCH a >= b.
_version_ge() {
  local a_major a_minor a_patch b_major b_minor b_patch
  IFS=. read -r a_major a_minor a_patch <<< "$1"
  IFS=. read -r b_major b_minor b_patch <<< "$2"
  a_major="${a_major:-0}"; a_minor="${a_minor:-0}"; a_patch="${a_patch:-0}"
  (( 10#$a_major != 10#$b_major )) && { (( 10#$a_major > 10#$b_major )); return; }
  (( 10#$a_minor != 10#$b_minor )) && { (( 10#$a_minor > 10#$b_minor )); return; }
  (( 10#$a_patch >= 10#$b_patch ))
}

NODE_VERSION="$(node --version 2>/dev/null || true)"
NODE_VERSION="${NODE_VERSION#v}"
NODE_VERSION="${NODE_VERSION%%-*}"
if [[ ! "$NODE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || ! _version_ge "$NODE_VERSION" "$CLI_NODE_FLOOR"; then
  _warn "Node ${NODE_VERSION:-unknown} found, ${CLI_NODE_FLOOR} or later required, client step skipped"
  exit 0
fi

# Detection and comparison wrapper, run with `node -e`. Arguments (never
# interpolated into the source): process.argv[1] = target version,
# process.argv[2] = timeout in ms. Runs `npm ls -g --json --depth=0
# arcanum-cli` bounded by spawnSync's timeout (macOS has no portable
# `timeout`), parses its JSON (never its exit code) and prints KEY=value
# lines:
#   CLI_STATE=missing|older|same|newer|linked|unknown
#   CLI_INSTALLED=<v>   when the installed version is known
#   CLI_LINK=<path>     for `linked`, when npm reports a `file:` target
#   CLI_REASON=<text>   for `unknown`
# Semver precedence per already-installed.md's Version comparison: numeric
# MAJOR.MINOR.PATCH, a prerelease below its release, prerelease identifiers
# pairwise (numeric numerically, numeric before alphanumeric, else ASCII),
# a shorter identifier list lower, build metadata ignored.
CLI_DETECT_JS="$(cat <<'JS'
const { spawnSync } = require('child_process');
const target = process.argv[1];
const timeout = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 15000;
const out = (k, v) => process.stdout.write(k + '=' + String(v).replace(/[\r\n]+/g, ' ') + '\n');
const done = (state, extra) => {
  out('CLI_STATE', state);
  Object.keys(extra || {}).forEach((k) => { if (extra[k] !== undefined) out(k, extra[k]); });
  process.exit(0);
};
const unknown = (reason, installed) => done('unknown', { CLI_INSTALLED: installed, CLI_REASON: reason });
const parse = (v) => {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(String(v));
  return m && { nums: [m[1], m[2], m[3]].map(BigInt), pre: m[4] ? m[4].split('.') : [] };
};
const sign = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cmpId = (a, b) => {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) return sign(BigInt(a), BigInt(b));
  if (an !== bn) return an ? -1 : 1;
  return sign(a, b);
};
const compare = (a, b) => {
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return sign(a.nums[i], b.nums[i]);
  if (!a.pre.length || !b.pre.length) return sign(b.pre.length, a.pre.length);
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const c = cmpId(a.pre[i], b.pre[i]);
    if (c) return c;
  }
  return sign(a.pre.length, b.pre.length);
};
const wanted = parse(target);
if (!wanted) unknown('target version is not plain semver');
const r = spawnSync('npm', ['ls', '-g', '--json', '--depth=0', 'arcanum-cli'], {
  encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'],
});
if (r.error) unknown(r.error.code === 'ETIMEDOUT' ? 'npm ls timed out' : 'npm ls could not run');
if (r.signal) unknown('npm ls timed out');
if (!r.stdout || !r.stdout.trim()) unknown('npm ls printed nothing');
let data;
try { data = JSON.parse(r.stdout); } catch (e) { unknown('npm ls printed invalid JSON'); }
if (!data || typeof data !== 'object') unknown('npm ls printed unexpected JSON');
const entry = data.dependencies && data.dependencies['arcanum-cli'];
if (entry === undefined || entry === null) done('missing');
if (typeof entry !== 'object') unknown('npm ls reported an unreadable arcanum-cli entry');
const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
if (entry.link === true || resolved.startsWith('file:')) {
  done('linked', { CLI_LINK: resolved.startsWith('file:') ? resolved.slice(5) : undefined });
}
if (entry.missing === true || entry.version === undefined || entry.version === null || entry.version === '') {
  unknown('npm ls reported arcanum-cli without a version');
}
const have = parse(entry.version);
if (!have) unknown('installed version ' + entry.version + ' is not plain semver', entry.version);
const c = compare(have, wanted);
done(c < 0 ? 'older' : c > 0 ? 'newer' : 'same', { CLI_INSTALLED: entry.version });
JS
)"

# _path_check — warns when `arcanum` on PATH is not the client in the npm
# global prefix (filled in with the install flow).
_path_check() {
  :
}

# 5. Detect the installed client (local `npm ls`, no network).
CLI_STATE=""
CLI_INSTALLED=""
CLI_LINK=""
CLI_REASON=""
CLI_DETECT_OUT="$(node -e "$CLI_DETECT_JS" "$VERSION" "$CLI_TIMEOUT_MS" 2>/dev/null || true)"
while IFS= read -r _line; do
  case "$_line" in
    CLI_STATE=*) CLI_STATE="${_line#CLI_STATE=}" ;;
    CLI_INSTALLED=*) CLI_INSTALLED="${_line#CLI_INSTALLED=}" ;;
    CLI_LINK=*) CLI_LINK="${_line#CLI_LINK=}" ;;
    CLI_REASON=*) CLI_REASON="${_line#CLI_REASON=}" ;;
  esac
done <<< "$CLI_DETECT_OUT"

case "$CLI_STATE" in
  same)
    _info "${CLI_PACKAGE}@${VERSION} is already up to date."
    _path_check
    exit 0
    ;;
  newer)
    _info "${CLI_PACKAGE}@${CLI_INSTALLED} is newer than ${VERSION}; left as is. Downgrade with: npm i -g --ignore-scripts ${CLI_PACKAGE}@${VERSION}"
    _path_check
    exit 0
    ;;
  linked)
    if [[ -n "$CLI_LINK" ]]; then
      _info "${CLI_PACKAGE} is linked from ${CLI_LINK}; left as is."
    else
      _info "${CLI_PACKAGE} is linked (npm link); left as is."
    fi
    exit 0
    ;;
  older|missing)
    ;;
  *)
    _warn "could not read the installed ${CLI_PACKAGE} version (${CLI_REASON:-npm ls failed}), client step skipped"
    exit 0
    ;;
esac
