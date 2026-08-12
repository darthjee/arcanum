#!/usr/bin/env bash
# Commit an issue file created by the auto-new-issue skill
# Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>
#
# Stages <file_path> and commits it using the repo's commit message
# template (.github/commit_message_template.md), with type=docs,
# scope=issue, subject="add issue file", and agent fixed to "architect"
# (auto-new-issue always commits issues created by the architect).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../arcanum/_lib/push.sh"
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:-}"
FILE_PATH="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$REPO_PATH" && -n "$FILE_PATH" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <file_path> <id> <model_name> <model_email>" >&2
  exit 1
}

repo_path_enter "$REPO_PATH"

[[ -f "$FILE_PATH" ]] || { echo "Error: file not found: $FILE_PATH" >&2; exit 1; }

git add "$FILE_PATH"

{
  echo "docs(issue): add issue file (issue #${ID})"
  echo
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
  echo "Co-Authored-By: architect agent <${MODEL_EMAIL}>"
} | git commit -F -

push_current_branch
