#!/usr/bin/env bash
# Shell implementation of the "auto-fix-all-queue-next" migrated
# entrypoint — invoked by queue.sh's engine_dispatch shim. Prints the
# first ID without removing it (empty output = done).
# Usage: queue_next_shell.sh <repo_path>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=queue_common.sh
source "${SCRIPT_DIR}/queue_common.sh"

REPO_PATH="${1:?Usage: $0 <repo_path>}"
_read_queue | jq -r '.[0].id // ""'
