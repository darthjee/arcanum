#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-config-get" migrated
# entrypoint — invoked by config.sh's engine_dispatch shim.
# Usage: config_get_shell.sh <repo_path> <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_common.sh
source "${SCRIPT_DIR}/config_common.sh"
# shellcheck source=../../arcanum/_lib/repo_path.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:-}"
repo_path_enter "$REPO_PATH"

if [[ $# -lt 2 ]]; then
  echo "Error: get requires a key" >&2
  exit 1
fi
KEY="$2"
VALUE=$(repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY")
VALUE="${VALUE:-false}"
echo "$VALUE"
