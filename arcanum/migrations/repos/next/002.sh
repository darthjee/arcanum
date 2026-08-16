#!/usr/bin/env bash
# Migration 002 (next): grant the shared, committed
# .claude/settings.json a narrow Bash-permission allowlist entry for
# auto-fix-all/scripts/wait_ci_and_merge.sh — the `shipit`-preapproved
# merge path (see issue #170 and 002.md).
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

TARGET_FILE=".claude/settings.json"
PATTERN="Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)"

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

  echo "This grants '${PATTERN}' in the shared, committed ${TARGET_FILE},"
  echo "visible to every contributor, so Claude Code's own permission"
  echo "classifier no longer confirms before running"
  echo "auto-fix-all/scripts/wait_ci_and_merge.sh — the script that waits"
  echo "for CI then merges a PR, used ONLY for issues pre-approved via the"
  echo "human-only 'shipit' label. It does not exempt any other Bash"
  echo "command, and the normal review-approved merge path (a separate"
  echo "'scripts/github.sh pr-merge' call) is untouched and still confirmed."
  echo "Warning: this value will be committed to the repo and visible to all contributors."
  printf '[Y]es/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*)
      permission_grant_add "$TARGET_FILE" "$PATTERN"
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
