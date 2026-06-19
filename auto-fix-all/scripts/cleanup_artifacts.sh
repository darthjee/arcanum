#!/usr/bin/env bash
# Remove planning artifacts (issue file + plan dir) once a PR is approved
# Usage: cleanup_artifacts.sh <issue_file> <plan_dir> <id> <model_name> <model_email>
#
# If <issue_file> is tracked by git, `git rm` it. If <plan_dir> exists and
# is tracked, `git rm -r` it. If anything ends up staged, commit it using
# the same commit message template style as commit_change.sh/commit_plan.sh
# (type=chore, scope=docs, subject "remove planning artifacts", agent
# fixed to "architect"). If nothing was staged, do nothing and exit 0
# silently.

set -euo pipefail

ISSUE_FILE="${1:-}"
PLAN_DIR="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$ISSUE_FILE" && -n "$PLAN_DIR" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <issue_file> <plan_dir> <id> <model_name> <model_email>" >&2
  exit 1
}

if [[ -n "$(git ls-files "$ISSUE_FILE" 2>/dev/null)" ]]; then
  git rm "$ISSUE_FILE" >/dev/null
fi

if [[ -d "$PLAN_DIR" ]] && [[ -n "$(git ls-files "$PLAN_DIR" 2>/dev/null)" ]]; then
  git rm -r "$PLAN_DIR" >/dev/null
fi

if git diff --cached --quiet; then
  exit 0
fi

{
  echo "chore(docs): remove planning artifacts (issue #${ID})"
  echo
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
  echo "Co-Authored-By: architect agent <${MODEL_EMAIL}>"
} | git commit -F -
