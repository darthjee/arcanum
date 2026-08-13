#!/usr/bin/env bash
# Migration 001 (next): seed default plan-issues retry/backoff config.
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count" 5
  repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "error-sleep-time" 5
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
