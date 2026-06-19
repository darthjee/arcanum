#!/usr/bin/env bash
# Commit an issue file created by the auto-new-issue skill
# Usage: commit_issue.sh <file_path> <id> <model_name> <model_email>
#
# Stages <file_path> and commits it using the repo's commit message
# template (.github/commit_message_template.md), with type=docs,
# scope=issue, subject="add issue file", and agent fixed to "architect"
# (auto-new-issue always commits issues created by the architect).

set -euo pipefail

FILE_PATH="${1:-}"
ID="${2:-}"
MODEL_NAME="${3:-}"
MODEL_EMAIL="${4:-}"

[[ -n "$FILE_PATH" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <file_path> <id> <model_name> <model_email>" >&2
  exit 1
}

[[ -f "$FILE_PATH" ]] || { echo "Error: file not found: $FILE_PATH" >&2; exit 1; }

git add "$FILE_PATH"

{
  echo "docs(issue): add issue file (issue #${ID})"
  echo
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
  echo "Co-Authored-By: architect agent <${MODEL_EMAIL}>"
} | git commit -F -
