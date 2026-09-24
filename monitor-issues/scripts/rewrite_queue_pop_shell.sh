#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-rewrite-queue-pop" migrated
# entrypoint — invoked by rewrite_queue.sh's engine_dispatch shim.
# Removes and prints the first entry's id (plain text, one line) under
# lock. Prints nothing and exits 1 if the queue is empty.
# Usage: rewrite_queue_pop_shell.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=rewrite_queue_common.sh
source "${SCRIPT_DIR}/rewrite_queue_common.sh"

_acquire_lock
ID=$(_read_queue | jq -r '.[0].id // ""')
if [[ -z "$ID" ]]; then
  _release_lock
  exit 1
fi
_read_queue | jq '.[1:]' > "${QUEUE_FILE}.tmp"
mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
_release_lock
echo "$ID"
