#!/usr/bin/env bash
# Migration 002 (next): grant this clone's gitignored
# .claude/settings.local.json a bundle of three narrow Bash-permission
# allowlist entries for the common, fixed scripts/commands every
# dispatched specialist agent relies on — commit_change.sh,
# run_checks.sh, and `git add` (see issue #205 and 002.md).
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

TARGET_FILE=".claude/settings.local.json"
PATTERN_COMMIT="Bash(auto-fix-issue/scripts/commit_change.sh *)"
PATTERN_CHECKS="Bash(auto-fix-issue/scripts/run_checks.sh *)"
PATTERN_GIT_ADD="Bash(git add *)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs).
    # This loosens a security gate (a permission allowlist), so unlike
    # the git.email migrations' "guess and write silently" default,
    # the opposite default applies here: skip silently rather than
    # writing without an explicit human "yes".
    exit 0
  fi

  echo "This grants a bundle of three permissions in this clone's gitignored"
  echo "${TARGET_FILE}, so Claude Code's own permission classifier no longer"
  echo "confirms before running the common specialist-dispatch commit/check"
  echo "exemption package (see issue #205):"
  echo "  - '${PATTERN_COMMIT}' — auto-fix-issue/scripts/commit_change.sh,"
  echo "    every dispatched specialist's own commit+push path."
  echo "  - '${PATTERN_CHECKS}' — auto-fix-issue/scripts/run_checks.sh,"
  echo "    every dispatched specialist's own test/lint runner."
  echo "  - '${PATTERN_GIT_ADD}' — the raw 'git add' staging call each"
  echo "    dispatched specialist runs immediately before commit_change.sh."
  echo "It does not exempt any other Bash command."
  echo "This is local to your own clone — not committed, not shared."
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
