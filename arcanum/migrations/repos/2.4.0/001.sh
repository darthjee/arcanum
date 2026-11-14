#!/usr/bin/env bash
# Migration 001 (next): seed the "auto-fix-all" namespace in the committed
# .claude/configuration/arcanum-repo-config.json from the legacy
# .claude/configuration/auto-fix-all.json (if not already present), then
# delete the legacy auto-fix-all.json and monitor-issues.json files. See
# 001.md for a human-readable summary of what this does and why.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

REPO_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
LEGACY_AUTO_FIX_ALL_FILE=".claude/configuration/auto-fix-all.json"
LEGACY_MONITOR_ISSUES_FILE=".claude/configuration/monitor-issues.json"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  # Seed first: under set -e, a failed seed (e.g. invalid legacy JSON)
  # aborts before anything is deleted.
  repo_config_seed "$REPO_CONFIG_FILE" "$LEGACY_AUTO_FIX_ALL_FILE" auto-fix-all
  rm -f "$LEGACY_AUTO_FIX_ALL_FILE" "$LEGACY_MONITOR_ISSUES_FILE"
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
