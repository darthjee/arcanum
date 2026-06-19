#!/usr/bin/env bash
# Create or checkout the branch defined in the implementation plan
# Usage: create_branch.sh <plan_dir> <id>
#
# Reads <plan_dir>/plan.md and looks for a "## Branch" section to determine
# the branch name (the line right after the heading, backticks and
# whitespace stripped). Falls back to "issue-<id>" if the plan file does
# not exist, has no "## Branch" section, or the extracted name is empty.
#
# If the branch already exists locally, checks it out; otherwise creates
# it. Prints the resulting branch name to stdout (single line).

set -euo pipefail

PLAN_DIR="${1:-}"
ID="${2:-}"

[[ -n "$PLAN_DIR" && -n "$ID" ]] || {
  echo "Usage: $0 <plan_dir> <id>" >&2
  exit 1
}

PLAN_FILE="${PLAN_DIR}/plan.md"

BRANCH=""
if [[ -f "$PLAN_FILE" ]]; then
  BRANCH=$(grep -A2 '^## Branch' "$PLAN_FILE" | tail -1 | tr -d '`[:space:]' || true)
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="issue-${ID}"
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

echo "$BRANCH"
