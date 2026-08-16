#!/usr/bin/env bash
# Migration 003 (next): grant Claude Code's own cross-project
# ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json a narrow Bash-
# permission allowlist entry for
# auto-fix-all/scripts/wait_ci_and_merge.sh — the `shipit`-preapproved
# merge path (see issue #170 and 003.md).
#
# This is Claude Code's own native global settings file, NOT arcanum's
# own ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json that
# lives in the same directory — see arcanum/_lib/global_config.sh for
# that one. Only the former is read by Claude Code's permission
# classifier.
#
# Usage: 003.sh config
#        003.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

PATTERN="Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)"

# _global_settings_file
#   Prints the resolved path to Claude Code's own native global
#   settings.json, or nothing if it can't be resolved (no $HOME and no
#   $CLAUDE_CONFIG_DIR). Always exits 0. Mirrors
#   arcanum/_lib/global_config.sh's own _global_config_file, but for
#   Claude Code's native settings.json rather than arcanum's own
#   arcanum-config.json.
_global_settings_file() {
  local dir="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}"
  [[ -n "$dir" ]] || return 0
  echo "${dir}/settings.json"
}

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  local target
  target="$(_global_settings_file)"
  if [[ -z "$target" ]]; then
    echo "Warning: could not resolve a global config location (no \$HOME or \$CLAUDE_CONFIG_DIR) — the '${PATTERN}' permission was not written." >&2
    return 0
  fi

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs).
    # This loosens a security gate (a permission allowlist) across
    # every arcanum-onboarded repo on this machine/account, so unlike
    # the git.email migrations' "guess and write silently" default,
    # the opposite default applies here: skip silently rather than
    # writing without an explicit human "yes".
    return 0
  fi

  echo "This grants '${PATTERN}' in Claude Code's own cross-project"
  echo "${target}, so Claude Code's own permission classifier no longer"
  echo "confirms before running auto-fix-all/scripts/wait_ci_and_merge.sh"
  echo "— on EVERY arcanum-onboarded repo on this machine/account, not just"
  echo "this one. That script waits for CI then merges a PR, used ONLY for"
  echo "issues pre-approved via the human-only 'shipit' label. It does not"
  echo "exempt any other Bash command, and the normal review-approved merge"
  echo "path (a separate 'scripts/github.sh pr-merge' call) is untouched"
  echo "and still confirmed."
  printf '[Y]es/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*)
      permission_grant_add "$target" "$PATTERN"
      ;;
    *)
      # Skip — nothing written. The migration still completes
      # successfully; the exemption simply isn't seeded in this tier.
      ;;
  esac
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
