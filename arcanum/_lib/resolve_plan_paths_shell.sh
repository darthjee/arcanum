#!/usr/bin/env bash
# Shell implementation of the "resolve-plan-paths" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/235-migrate-resolve-plan-paths-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Invoked either directly (when
# engine.mode=shell) or as the fallback for engine.mode=native without
# a native implementation yet, via arcanum/_lib/resolve_plan_paths.sh's
# engine_dispatch shim — never called directly by skills.
#
# Resolve the issue file and plan dir/file for a given issue ID.
# Usage: resolve_plan_paths_shell.sh <repo_path> <issues_folder> <plans_folder> <id>
#
# Output (key=value lines):
#   ISSUE_FILE=<path>
#   PLAN_DIR=<path>
#   PLAN_FILE=<path>
#   PLAN_EXISTS=true|false

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=repo_path.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/repo_path.sh"

REPO_PATH="${1:-}"
ISSUES_FOLDER="${2:-}"
PLANS_FOLDER="${3:-}"
ID="${4:-}"

[[ -n "$ISSUES_FOLDER" && -n "$PLANS_FOLDER" && -n "$ID" ]] || {
  echo "Usage: $0 <repo_path> <issues_folder> <plans_folder> <id>" >&2
  exit 1
}

repo_path_enter "$REPO_PATH"

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
