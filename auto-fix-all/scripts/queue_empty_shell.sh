#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-empty" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Exits 0 if the
# queue is empty, exit 1 if it has items.
# Usage: queue_empty_shell.sh <repo_path>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path>}"
if [[ "$(_read_queue | jq 'length')" -eq 0 ]]; then
  exit 0
fi
exit 1
