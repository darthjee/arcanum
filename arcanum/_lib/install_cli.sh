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
