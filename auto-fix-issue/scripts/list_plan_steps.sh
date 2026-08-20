#!/usr/bin/env bash
# List a specialist agent's ordered step files inside a plan dir
# Usage: list_plan_steps.sh <plan_dir> <agent_name>
#
# Lists all *.md files directly inside <plan_dir>/<agent_name> (no
# recursion, no filenames excluded). Each file is one ordered step for
# that agent's plan. Output: one file path per line, formatted as
# <plan_dir>/<agent_name>/<file>, ordered alphabetically by filename.
# Prints nothing (exit 0) if <plan_dir>/<agent_name> does not exist or
# is empty — that just means the agent's plan is inline, not split.

set -euo pipefail

PLAN_DIR="${1:-}"
AGENT_NAME="${2:-}"

[[ -n "$PLAN_DIR" && -n "$AGENT_NAME" ]] || {
  echo "Usage: $0 <plan_dir> <agent_name>" >&2
  exit 1
}

[[ -d "$PLAN_DIR/$AGENT_NAME" ]] || exit 0

shopt -s nullglob
FILES=("$PLAN_DIR/$AGENT_NAME"/*.md)
shopt -u nullglob

[[ ${#FILES[@]} -gt 0 ]] || exit 0

IFS=$'\n' SORTED_FILES=($(printf '%s\n' "${FILES[@]}" | sort))
unset IFS

for file in "${SORTED_FILES[@]}"; do
  echo "$file"
done
