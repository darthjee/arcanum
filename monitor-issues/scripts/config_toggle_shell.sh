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
TIER="$(_write_tier_for_key "$KEY")"
# config-key: monitor-issues.clear_context
CURRENT=$(config_tier_read "." "$TIER" "$NAMESPACE" "$KEY")
CURRENT="${CURRENT:-false}"
if [[ "$CURRENT" == "true" ]]; then
  NEW_VALUE="false"
else
  NEW_VALUE="true"
fi
# config-key: monitor-issues.clear_context
config_tier_write "." "$TIER" "$NAMESPACE" "$KEY" "$NEW_VALUE"
echo "$NEW_VALUE"
