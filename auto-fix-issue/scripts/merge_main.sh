#!/usr/bin/env bash
# Merge origin/main into the currently checked-out issue branch
# Usage: merge_main.sh
#
# Assumes the target issue branch is already checked out — this just
# brings it up to date with "origin/main" (fetches, then merges with
# --no-edit; a missing "origin/main" ref is a no-op).
#
# Prints "STATUS=ok" or "STATUS=conflict" (with the conflicted-file list,
# one path per line, printed after the STATUS line when there's a
# conflict). Exits 0 on "ok", 2 on "conflict".

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/git_branch.sh
source "${SCRIPT_DIR}/../../_lib/git_branch.sh"

STATUS="ok"
CONFLICTS=""

if CONFLICTS=$(git_branch_merge_main); then
  STATUS="ok"
else
  STATUS="conflict"
fi

echo "STATUS=${STATUS}"
if [[ "$STATUS" == "conflict" ]]; then
  echo "$CONFLICTS"
fi

if [[ "$STATUS" == "conflict" ]]; then
  exit 2
fi
exit 0
