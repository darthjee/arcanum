#!/usr/bin/env bash
# Migration 002 (next): no-op seed migration, applies_to "global". Its
# sole purpose is to initialize .migrations.version in the global
# config file (${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json)
# for every install, now that "global" exists as a real applies_to
# scope (see arcanum/migrations/_manifest.sh and
# arcanum/_lib/global_config.sh). No other effect. See 002.md for a
# human-readable summary.
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  exit 0
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
