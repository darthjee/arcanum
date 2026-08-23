#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-push" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Appends the
# given IDs to the end of the queue (locked), then best-effort tags the
# affected issues as enqueued.
# Usage: queue_push_shell.sh <repo_path> <id...>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path> <id...>}"
shift

if [[ $# -eq 0 ]]; then
  echo "Error: push requires at least one ID" >&2
  exit 1
fi
PUSH_IDS=("$@")
_acquire_lock
NEW_ENTRIES=$(printf '%s\n' "${PUSH_IDS[@]}" | jq -R '{id: .}' | jq -s '.')
_read_queue | jq --argjson new "$NEW_ENTRIES" '. + $new' > "${QUEUE_FILE}.tmp"
mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
_release_lock
echo "Pushed: ${PUSH_IDS[*]}"
_mark_enqueued "$REPO_PATH" "${PUSH_IDS[@]}"
