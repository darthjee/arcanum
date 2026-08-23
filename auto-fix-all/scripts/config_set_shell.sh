#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-config-set" migrated
# entrypoint — invoked by config.sh's engine_dispatch shim.
# Usage: config_set_shell.sh <repo_path> <key> <value>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_common.sh
source "${SCRIPT_DIR}/config_common.sh"
# shellcheck source=../../arcanum/_lib/repo_path.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:-}"
repo_path_enter "$REPO_PATH"

if [[ $# -lt 3 ]]; then
  echo "Error: set requires a key and a value (true|false)" >&2
  exit 1
fi
KEY="$2"
VALUE="$3"
if [[ "$VALUE" != "true" && "$VALUE" != "false" ]]; then
  echo "Error: value must be 'true' or 'false'" >&2
  exit 1
fi
repo_config_write "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY" "$VALUE"
