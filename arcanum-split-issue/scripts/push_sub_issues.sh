#!/usr/bin/env bash
# Batch driver: push every generated sub-issue draft file for <issue_id>
# to GitHub, in ascending count order, stopping at the first failure.
# Usage: push_sub_issues.sh <repo_path> <issue_id>
#
# On success (or zero files to process) prints:
#   STATUS=ok
#   CREATED=<file>:<id>[,<file>:<id>...]   (possibly empty)
# and exits 0.
#
# On the first failure, stops immediately (does not process remaining
# files) and prints:
#   STATUS=failed
#   CREATED=<csv of file:id pairs that succeeded so far, possibly empty>
#   FAILED=<the file that failed>
# and exits 1.

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

ISSUES_DIR="docs/agents/issues"

shopt -s nullglob
FILES=("${ISSUES_DIR}/${ISSUE_ID}_"[0-9][0-9]*_*)
shopt -u nullglob

IFS=$'\n' FILES=($(printf '%s\n' "${FILES[@]+"${FILES[@]}"}" | sort))
unset IFS

CREATED=""

for file in "${FILES[@]+"${FILES[@]}"}"; do
  OUTPUT=""
  EXIT_CODE=0
  OUTPUT=$("${SCRIPT_DIR}/create_sub_issue.sh" "$REPO_PATH" "$ISSUE_ID" "$file") || EXIT_CODE=$?

  STATUS_LINE=$(printf '%s\n' "$OUTPUT" | grep -m1 '^STATUS=' || true)
  ID_LINE=$(printf '%s\n' "$OUTPUT" | grep -m1 '^ID=' || true)

  if [[ "$EXIT_CODE" -eq 0 && "$STATUS_LINE" == "STATUS=ok" ]]; then
    new_id="${ID_LINE#ID=}"
    if [[ -n "$CREATED" ]]; then
      CREATED="${CREATED},${file}:${new_id}"
    else
      CREATED="${file}:${new_id}"
    fi
    continue
  fi

  echo "STATUS=failed"
  echo "CREATED=${CREATED}"
  echo "FAILED=${file}"
  exit 1
done

echo "STATUS=ok"
echo "CREATED=${CREATED}"
