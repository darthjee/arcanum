#!/usr/bin/env bash
# Migration 001 (next): seed the "monitor-issues" namespace in the
# per-clone, gitignored .claude/state/arcanum-config.json from the legacy
# .claude/state/monitor-issues-config.json (which held clear_context), if
# not already present. See 001.md for a human-readable summary of what
# this does and why.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_STATE_FILE=".claude/state/arcanum-config.json"
LEGACY_STATE_FILE=".claude/state/monitor-issues-config.json"
NAMESPACE="monitor-issues"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": false}'
}

cmd_run() {
  repo_config_seed "$NEW_STATE_FILE" "$LEGACY_STATE_FILE" "$NAMESPACE"
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
