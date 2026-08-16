#!/usr/bin/env bash
# Migration 001 (next): grant this clone's gitignored
# .claude/settings.local.json a narrow Bash-permission allowlist entry
# for auto-fix-all/scripts/wait_ci_and_merge.sh — the `shipit`-
# preapproved merge path (see issue #170 and 001.md).
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/permission_grant.sh
source "${SCRIPT_DIR}/../../../_lib/permission_grant.sh"

TARGET_FILE=".claude/settings.local.json"
PATTERN="Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)"

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

  echo "This grants '${PATTERN}' in this clone's gitignored ${TARGET_FILE},"
  echo "so Claude Code's own permission classifier no longer confirms before"
  echo "running auto-fix-all/scripts/wait_ci_and_merge.sh — the script that"
  echo "waits for CI then merges a PR, used ONLY for issues pre-approved via"
  echo "the human-only 'shipit' label. It does not exempt any other Bash"
  echo "command, and the normal review-approved merge path (a separate"
  echo "'scripts/github.sh pr-merge' call) is untouched and still confirmed."
  echo "This is local to your own clone — not committed, not shared."
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
