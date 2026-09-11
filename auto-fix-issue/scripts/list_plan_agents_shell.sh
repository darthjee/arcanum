#!/usr/bin/env bash
# List specialist agents that have their own plan file in a plan dir
# Usage: list_plan_agents.sh <plan_dir>
#
# Lists all *.md files inside <plan_dir> except plan.md. Each matching
# file (e.g. backend.md) corresponds to a specialist agent (backend).
# Output: one agent name per line, ordered alphabetically by filename.
# Prints nothing (exit 0) if <plan_dir> does not exist or has no agent
# files (only plan.md, or empty).

set -euo pipefail

PLAN_DIR="${1:-}"

[[ -n "$PLAN_DIR" ]] || {
  echo "Usage: $0 <plan_dir>" >&2
  exit 1
}

[[ -d "$PLAN_DIR" ]] || exit 0

shopt -s nullglob
FILES=("$PLAN_DIR"/*.md)
shopt -u nullglob

[[ ${#FILES[@]} -gt 0 ]] || exit 0

IFS=$'\n' SORTED_FILES=($(printf '%s\n' "${FILES[@]}" | sort))
unset IFS

for file in "${SORTED_FILES[@]}"; do
  NAME=$(basename "$file" .md)
  [[ "$NAME" == "plan" ]] && continue
  echo "$NAME"
done
