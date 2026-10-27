#!/usr/bin/env bash
# Migration 001 (next): install or update the `arcanum-cli` npm package
# globally, pinned to the installed arcanum version (#872). Global,
# skippable, runs once per machine/account. Choosing [R]un at the
# migration prompt is the consent, so the shared client step is called
# with --no-confirm (no second prompt, no /dev/tty). Always exits 0
# (warn and continue), so the global pointer advances either way.
# Spec: docs/agents/specs/cli-install/update.md, "Global migration".
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

# Paths come from this script's own location, never from the cwd (the
# consuming repo). The depth holds after bump-version.sh renames next/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
INSTALL_CLI="${INSTALL_ROOT}/arcanum/_lib/install_cli.sh"
ARCANUM_JSON="${INSTALL_ROOT}/arcanum.json"
MANUAL_COMMAND="npm i -g arcanum-cli"

cmd_config() {
  echo '{"skippable": true}'
}

# resolve_version
#   Prints the installed arcanum version: `.version` from arcanum.json,
#   else an exact git tag of the install tree (a `git clone` install,
#   passed as is). Prints nothing when neither resolves.
resolve_version() {
  local version=""
  if [[ -f "$ARCANUM_JSON" ]]; then
    version="$(jq -r '.version // empty' "$ARCANUM_JSON" 2>/dev/null || true)"
  fi
  if [[ -z "$version" ]]; then
    version="$(git -C "$INSTALL_ROOT" describe --tags --exact-match 2>/dev/null || true)"
  fi
  printf '%s' "$version"
}

cmd_run() {
  local version
  version="$(resolve_version)"

  if [[ -z "$version" ]]; then
    echo "arcanum-cli: warning: could not resolve the installed arcanum version; install the client manually with: ${MANUAL_COMMAND}"
    return 0
  fi

  # install_cli.sh writes every user-facing line to stderr; the runner
  # only shows a migration's stderr when it fails, so fold it into stdout.
  "$INSTALL_CLI" "$version" --no-confirm 2>&1 || true
  return 0
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
