#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-rewrite-queue-push" migrated
# entrypoint — invoked by rewrite_queue.sh's engine_dispatch shim.
# Appends <id> to the end of the queue if not already present (idempotent),
# under lock, and prints "Pushed: <id>". Exit 0 on success.
# Usage: rewrite_queue_push_shell.sh <id>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=rewrite_queue_common.sh
source "${SCRIPT_DIR}/rewrite_queue_common.sh"

ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "Error: push requires an ID" >&2
  exit 1
fi
_acquire_lock
_read_queue | jq --arg id "$ID" 'if any(.[]; .id == $id) then . else . + [{"id": $id}] end' > "${QUEUE_FILE}.tmp"
mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
_release_lock
echo "Pushed: $ID"
