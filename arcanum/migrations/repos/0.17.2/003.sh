#!/usr/bin/env bash
# Migration 003 (next): grant the shared, committed .claude/settings.json
# a bundle of three narrow Bash-permission allowlist entries for the
# common, fixed scripts/commands every dispatched specialist agent
# relies on — commit_change.sh, run_checks.sh, and `git add` (see
# issue #205 and 003.md).
#
# Usage: 003.sh config
#        003.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

TARGET_FILE=".claude/settings.json"
PATTERN_COMMIT="Bash(auto-fix-issue/scripts/commit_change.sh *)"
PATTERN_CHECKS="Bash(auto-fix-issue/scripts/run_checks.sh *)"
PATTERN_GIT_ADD="Bash(git add *)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs).
    # This loosens a security gate (a permission allowlist) that would
    # also be committed and shared with every contributor, so unlike
    # the git.email migrations' "guess and write silently" default,
    # the opposite default applies here: skip silently rather than
    # writing without an explicit human "yes".
    exit 0
  fi

  echo "This grants a bundle of three permissions in the shared, committed"
  echo "${TARGET_FILE}, visible to every contributor, so Claude Code's own"
  echo "permission classifier no longer confirms before running the common"
  echo "specialist-dispatch commit/check exemption package (see issue #205):"
  echo "  - '${PATTERN_COMMIT}' — auto-fix-issue/scripts/commit_change.sh,"
  echo "    every dispatched specialist's own commit+push path."
  echo "  - '${PATTERN_CHECKS}' — auto-fix-issue/scripts/run_checks.sh,"
  echo "    every dispatched specialist's own test/lint runner."
  echo "  - '${PATTERN_GIT_ADD}' — the raw 'git add' staging call each"
  echo "    dispatched specialist runs immediately before commit_change.sh."
  echo "It does not exempt any other Bash command."
  echo "Warning: this value will be committed to the repo and visible to all contributors."
  printf '[Y]es/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*)
      permission_grant_add "$TARGET_FILE" "$PATTERN_COMMIT"
      permission_grant_add "$TARGET_FILE" "$PATTERN_CHECKS"
      permission_grant_add "$TARGET_FILE" "$PATTERN_GIT_ADD"
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
