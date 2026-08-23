#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-wait-next" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Like `next`,
# but if the queue is empty, sleeps 5s and retries forever instead of
# returning empty.
# Usage: queue_wait_next_shell.sh <repo_path>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path>}"
while [[ "$(_read_queue | jq 'length')" -eq 0 ]]; do
  sleep 5
done
_read_queue | jq -r '.[0].id'
