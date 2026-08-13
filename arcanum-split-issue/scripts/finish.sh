#!/usr/bin/env bash
# Finish up after all sub-issues have been pushed successfully: relabel the
# parent issue (Planning -> Split) and delete the local working files.
# Usage: finish.sh <repo_path> <issue_id>

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" ]] || {
  echo "Usage: $0 <repo_path> <issue_id>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/repo_path.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

repo_path_enter "$REPO_PATH"

"${SCRIPT_DIR}/github.sh" mark-split "$REPO_PATH" "$ISSUE_ID"

ISSUES_DIR="docs/agents/issues"
DELETED=()

shopt -s nullglob
for f in "${ISSUES_DIR}/${ISSUE_ID}-"*; do
  rm -f "$f"
  DELETED+=("$f")
done
for f in "${ISSUES_DIR}/${ISSUE_ID}_"*; do
  rm -f "$f"
  DELETED+=("$f")
done
shopt -u nullglob

if [[ ${#DELETED[@]} -gt 0 ]]; then
  echo "Deleted:"
  for f in "${DELETED[@]}"; do
    echo "  $f"
  done
else
  echo "Deleted: (nothing to clean up)"
fi
