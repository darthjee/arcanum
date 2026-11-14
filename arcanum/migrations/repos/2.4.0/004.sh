#!/usr/bin/env bash
# Migration 004 (next): append the co-author policy line to the repo's
# AGENTS.md (if missing), so hand-written commits follow arcanum's resolved
# co-author config instead of Claude Code's attribution reminder. See 004.md
# for a human-readable summary of what this does and why.
#
# Usage: 004.sh config
#        004.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENSURE_COAUTHOR_POLICY="${SCRIPT_DIR}/../../../../init-claude/scripts/ensure_coauthor_policy.sh"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  bash "$ENSURE_COAUTHOR_POLICY" "$PWD"
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
