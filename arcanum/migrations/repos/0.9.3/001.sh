#!/usr/bin/env bash
# Migration 001: seed the namespaced arcanum-repo-config.json /
# arcanum-config.json files from the legacy auto-fix-all config/state
# files, under the "auto-fix-all" key. See 001.md for a human-readable
# summary of what this does and why.
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
  repo_config_seed ".claude/configuration/arcanum-repo-config.json" ".claude/configuration/auto-fix-all.json" auto-fix-all
  repo_config_seed ".claude/state/arcanum-config.json" ".claude/state/auto-fix-all-config.json" auto-fix-all
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
