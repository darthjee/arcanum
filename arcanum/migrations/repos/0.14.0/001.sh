#!/usr/bin/env bash
# Migration 001 (next): create .github/commit_message_template-2.0.md
# from arcanum's own installed copy, if not already present.
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_SRC="${SCRIPT_DIR}/../../../../init-claude/templates/commit_message_template-2.0.md"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  mkdir -p .github
  local dest=".github/commit_message_template-2.0.md"
  if [[ -f "$dest" ]]; then
    echo "Already present, left untouched: ${dest}"
  else
    cp "$TEMPLATE_SRC" "$dest"
    echo "Created: ${dest}"
  fi
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
