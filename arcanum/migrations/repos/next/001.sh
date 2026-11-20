#!/usr/bin/env bash
# Migration 001 (next): TODO summarize what this migration does.
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  echo "TODO: implement migration 001" >&2
  exit 1
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
