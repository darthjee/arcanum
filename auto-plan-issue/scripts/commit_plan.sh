#!/usr/bin/env bash
# Commit the implementation plan directory created by the auto-plan-issue skill
# Usage: commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>
#
# Stages all files under <plan_dir> and commits them using the repo's
# commit message template (.github/commit_message_template.md), with
# type=docs, scope=plan, subject="add implementation plan", and agent
# fixed to "architect" (auto-plan-issue always commits plans created by
# the architect).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../arcanum/_lib/push.sh"
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:-}"
PLAN_DIR="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$REPO_PATH" && -n "$PLAN_DIR" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <plan_dir> <id> <model_name> <model_email>" >&2
  exit 1
}

repo_path_enter "$REPO_PATH"

[[ -d "$PLAN_DIR" ]] || { echo "Error: directory not found: $PLAN_DIR" >&2; exit 1; }

git add "$PLAN_DIR"

{
  echo "docs(plan): add implementation plan (issue #${ID})"
  echo
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
  echo "Co-Authored-By: architect agent <${MODEL_EMAIL}>"
} | git commit -F -

push_current_branch
