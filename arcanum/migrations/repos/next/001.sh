#!/usr/bin/env bash
# Migration 001 (next): re-seed the "auto-fix-all" namespace in the
# committed .claude/configuration/arcanum-repo-config.json from the
# legacy .claude/configuration/auto-fix-all.json, if not already
# present. See 001.md for a human-readable summary of what this does
# and why.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": false}'
}

cmd_run() {
  repo_config_seed ".claude/configuration/arcanum-repo-config.json" ".claude/configuration/auto-fix-all.json" auto-fix-all
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
