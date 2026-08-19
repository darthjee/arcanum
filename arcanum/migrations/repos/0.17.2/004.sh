#!/usr/bin/env bash
# Migration 004 (next): grant Claude Code's own cross-project
# ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json a bundle of three
# narrow Bash-permission allowlist entries for the common, fixed
# scripts/commands every dispatched specialist agent relies on —
# commit_change.sh, run_checks.sh, and `git add` (see issue #205 and
# 004.md).
#
# This is Claude Code's own native global settings file, NOT arcanum's
# own ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json that
# lives in the same directory — see arcanum/_lib/global_config.sh for
# that one. Only the former is read by Claude Code's permission
# classifier.
#
# Usage: 004.sh config
#        004.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

PATTERN_COMMIT="Bash(auto-fix-issue/scripts/commit_change.sh *)"
PATTERN_CHECKS="Bash(auto-fix-issue/scripts/run_checks.sh *)"
PATTERN_GIT_ADD="Bash(git add *)"

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
    echo "Warning: could not resolve a global config location (no \$HOME or \$CLAUDE_CONFIG_DIR) — the specialist-dispatch commit/check permission bundle was not written." >&2
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

  echo "This grants a bundle of three permissions in Claude Code's own"
  echo "cross-project ${target} — on EVERY arcanum-onboarded repo on this"
  echo "machine/account, not just this one — so Claude Code's own permission"
  echo "classifier no longer confirms before running the common"
  echo "specialist-dispatch commit/check exemption package (see issue #205):"
  echo "  - '${PATTERN_COMMIT}' — auto-fix-issue/scripts/commit_change.sh,"
  echo "    every dispatched specialist's own commit+push path."
  echo "  - '${PATTERN_CHECKS}' — auto-fix-issue/scripts/run_checks.sh,"
  echo "    every dispatched specialist's own test/lint runner."
  echo "  - '${PATTERN_GIT_ADD}' — the raw 'git add' staging call each"
  echo "    dispatched specialist runs immediately before commit_change.sh."
  echo "It does not exempt any other Bash command."
  printf '[Y]es/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*)
      permission_grant_add "$target" "$PATTERN_COMMIT"
      permission_grant_add "$target" "$PATTERN_CHECKS"
      permission_grant_add "$target" "$PATTERN_GIT_ADD"
      ;;
    *)
      # Skip — nothing written. The migration still completes
      # successfully; the exemption bundle simply isn't seeded in this
      # tier.
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
