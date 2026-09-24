#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-config-toggle" migrated
# entrypoint — invoked by config.sh's engine_dispatch shim.
# Flips the key and prints the new value.
# Usage: config_toggle_shell.sh <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_common.sh
source "${SCRIPT_DIR}/config_common.sh"

if [[ $# -lt 1 ]]; then
  echo "Error: toggle requires a key" >&2
  exit 1
fi
KEY="$1"
TARGET_FILE="$(_config_file_for_key "$KEY")"
_acquire_lock
CURRENT=$(_read_config "$TARGET_FILE" | jq -r --arg k "$KEY" '.[$k] // false')
if [[ "$CURRENT" == "true" ]]; then
  NEW_VALUE="false"
else
  NEW_VALUE="true"
fi
_read_config "$TARGET_FILE" | jq --arg k "$KEY" --arg v "$NEW_VALUE" '.[$k] = ($v == "true")' > "${TARGET_FILE}.tmp"
mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
_release_lock
echo "$NEW_VALUE"
