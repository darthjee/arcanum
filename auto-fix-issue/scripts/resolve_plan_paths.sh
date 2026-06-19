#!/usr/bin/env bash
# Resolve the issue file and plan dir/file for a given issue ID
# Usage: resolve_plan_paths.sh <issues_folder> <plans_folder> <id>
#
# Output (key=value lines):
#   ISSUE_FILE=<path>
#   PLAN_DIR=<path>
#   PLAN_FILE=<path>
#   PLAN_EXISTS=true|false

set -euo pipefail

ISSUES_FOLDER="${1:-}"
PLANS_FOLDER="${2:-}"
ID="${3:-}"

[[ -n "$ISSUES_FOLDER" && -n "$PLANS_FOLDER" && -n "$ID" ]] || {
  echo "Usage: $0 <issues_folder> <plans_folder> <id>" >&2
  exit 1
}

[[ "$ID" =~ ^[0-9]+$ ]] || {
  echo "Error: issue id must be numeric and linked to a GitHub issue (got '${ID}'). Local-only ids are no longer supported." >&2
  exit 1
}

find_existing_file() {
  find "$ISSUES_FOLDER" -maxdepth 1 \( -name "${1}_*" -o -name "${1}-*" \) 2>/dev/null | head -1
}

ISSUE_FILE=$(find_existing_file "$ID")

[[ -n "$ISSUE_FILE" ]] || {
  echo "Error: no issue file found for id ${ID}" >&2
  exit 1
}

BASE_NAME=$(basename "$ISSUE_FILE" .md)
PLAN_DIR="${PLANS_FOLDER}/${BASE_NAME}"
PLAN_FILE="${PLAN_DIR}/plan.md"

if [[ -f "$PLAN_FILE" ]]; then
  PLAN_EXISTS=true
else
  PLAN_EXISTS=false
fi

mkdir -p "$PLAN_DIR"

printf 'ISSUE_FILE=%s\nPLAN_DIR=%s\nPLAN_FILE=%s\nPLAN_EXISTS=%s\n' \
  "$ISSUE_FILE" "$PLAN_DIR" "$PLAN_FILE" "$PLAN_EXISTS"
