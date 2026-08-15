#!/usr/bin/env bash
# List specialist agents configured in the target project
# Usage: list_agents.sh [agents_dir]
#
# Default agents_dir is .claude/agents (relative to current working directory).
# Output: one line per agent, format "<name>|<description>", ordered
# alphabetically by filename. Prints nothing (exit 0) if agents_dir does
# not exist or has no *.md files.

set -euo pipefail

AGENTS_DIR="${1:-.claude/agents}"

[[ -d "$AGENTS_DIR" ]] || exit 0

shopt -s nullglob
FILES=("$AGENTS_DIR"/*.md)
shopt -u nullglob

[[ ${#FILES[@]} -gt 0 ]] || exit 0

IFS=$'\n' SORTED_FILES=($(printf '%s\n' "${FILES[@]}" | sort))
unset IFS

extract_frontmatter_field() {
  local file="$1" field="$2"
  awk -v field="$field" '
    NR==1 && $0=="---" { in_fm=1; next }
    in_fm && $0=="---" { exit }
    in_fm {
      pattern = "^" field ":[ ]*"
      if ($0 ~ pattern) {
        sub(pattern, "")
        gsub(/^["'"'"']|["'"'"']$/, "")
        print
        exit
      }
    }
  ' "$file"
}

for file in "${SORTED_FILES[@]}"; do
  NAME=$(extract_frontmatter_field "$file" "name")
  DESCRIPTION=$(extract_frontmatter_field "$file" "description")
  [[ -n "$NAME" ]] || continue
  printf '%s|%s\n' "$NAME" "$DESCRIPTION"
done
