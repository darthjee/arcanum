#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-config-set" migrated
# entrypoint — invoked by config.sh's engine_dispatch shim.
# No stdout.
# Usage: config_set_shell.sh <key> true|false
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_common.sh
source "${SCRIPT_DIR}/config_common.sh"

if [[ $# -lt 2 ]]; then
  echo "Error: set requires a key and a value (true|false)" >&2
  exit 1
fi
KEY="$1"
VALUE="$2"
if [[ "$VALUE" != "true" && "$VALUE" != "false" ]]; then
  echo "Error: value must be 'true' or 'false'" >&2
  exit 1
fi
# config-key: monitor-issues.clear_context
repo_config_write "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY" "$VALUE"
