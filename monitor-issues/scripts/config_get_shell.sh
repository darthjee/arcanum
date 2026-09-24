#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-config-get" migrated
# entrypoint — invoked by config.sh's engine_dispatch shim.
# Prints the key's value (default "false").
# Usage: config_get_shell.sh <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_common.sh
source "${SCRIPT_DIR}/config_common.sh"

if [[ $# -lt 1 ]]; then
  echo "Error: get requires a key" >&2
  exit 1
fi
KEY="$1"
TARGET_FILE="$(_config_file_for_key "$KEY")"
_read_config "$TARGET_FILE" | jq -r --arg k "$KEY" '.[$k] // false'
