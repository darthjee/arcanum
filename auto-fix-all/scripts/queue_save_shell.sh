#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-save" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Overwrites the
# queue with the given IDs, then best-effort tags the affected issues as
# enqueued.
# Usage: queue_save_shell.sh <repo_path> <id...>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path> <id...>}"
shift

if [[ $# -eq 0 ]]; then
  echo "Error: save requires at least one ID" >&2
  exit 1
fi
SAVE_IDS=("$@")
printf '%s\n' "${SAVE_IDS[@]}" | jq -R '{id: .}' | jq -s '.' > "$QUEUE_FILE"
echo "Queue saved: ${SAVE_IDS[*]}"
_mark_enqueued "$REPO_PATH" "${SAVE_IDS[@]}"
