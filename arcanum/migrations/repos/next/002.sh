#!/usr/bin/env bash
# Migration 002 (next): add `Epic:fbca04` to this checkout's
# .claude/state/init-claude-config.json if it is not already there
# (issue #689), so a future manual sync_labels.sh re-run stays consistent
# with the init-claude defaults. Config-only — the live GitHub label is
# migration 001's job. An existing entry named `Epic` (case-insensitive)
# is left untouched. See 002.md for a human-readable summary.
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LABEL_NAME="Epic"
LABEL_COLOR="fbca04"
INIT_CLAUDE_CONFIG=".claude/state/init-claude-config.json"
WRITE_LABEL_CONFIG="${SCRIPT_DIR}/../../../../init-claude/scripts/write_label_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  if [[ ! -f "$INIT_CLAUDE_CONFIG" ]]; then
    echo "No ${INIT_CLAUDE_CONFIG}; skipping."
    return 0
  fi

  if jq -e --arg name "$LABEL_NAME" \
      'any((.labels // [])[]; (.name // "" | ascii_downcase) == ($name | ascii_downcase))' \
      "$INIT_CLAUDE_CONFIG" >/dev/null 2>&1; then
    echo "'${LABEL_NAME}' already present in ${INIT_CLAUDE_CONFIG}."
    return 0
  fi

  "$WRITE_LABEL_CONFIG" add "$INIT_CLAUDE_CONFIG" "${LABEL_NAME}:${LABEL_COLOR}"
  echo "Added '${LABEL_NAME}:${LABEL_COLOR}' to ${INIT_CLAUDE_CONFIG}."
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
