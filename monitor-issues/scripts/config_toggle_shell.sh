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
# config-key: monitor-issues.clear_context
CURRENT=$(repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY")
CURRENT="${CURRENT:-false}"
if [[ "$CURRENT" == "true" ]]; then
  NEW_VALUE="false"
else
  NEW_VALUE="true"
fi
# config-key: monitor-issues.clear_context
repo_config_write "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY" "$NEW_VALUE"
echo "$NEW_VALUE"
