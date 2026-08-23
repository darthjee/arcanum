#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-pop" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Removes the
# first ID (marks the current issue as done), locked.
# Usage: queue_pop_shell.sh <repo_path>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path>}"
_acquire_lock
_read_queue | jq '.[1:]' > "${QUEUE_FILE}.tmp"
mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
_release_lock
