#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-list" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Prints all
# remaining IDs.
# Usage: queue_list_shell.sh <repo_path>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path>}"
IDS=$(_read_queue | jq -r '.[].id')
if [[ -n "$IDS" ]]; then
  echo "$IDS"
else
  echo "(empty)"
fi
