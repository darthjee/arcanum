#!/usr/bin/env bash
# Create one local sub-issue draft file for a parent issue being split.
# Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>
#
# Scans docs/agents/issues/<issue_id>_[0-9][0-9]*_* for existing sub-issue
# files to determine the next zero-padded count (gap-tolerant — never fills
# a gap left by a deleted file, same convention as
# arcanum/migrations/generate_next.sh), snake_cases <title>, and writes
# docs/agents/issues/<issue_id>_<count>_<snake_title>.md with:
#   # <title>
#
#   <verbatim content of body_file>
#
# On success prints:
#   FILE=docs/agents/issues/<issue_id>_<count>_<snake_title>.md
# and exits 0.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"
TITLE="${3:-}"
BODY_FILE="${4:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" && -n "$TITLE" && -n "$BODY_FILE" ]] || {
  echo "Usage: $0 <repo_path> <issue_id> <title> <body_file>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/repo_path.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

repo_path_enter "$REPO_PATH"

[[ -f "$BODY_FILE" ]] || { echo "Error: file not found: $BODY_FILE" >&2; exit 1; }

title_to_snake_case() {
  # Same transformation as title_to_snake_case() in
  # arcanum/_lib/resolve_id_and_file.sh, with one portability tweak: the
  # underscore-collapse step is written as 's/__*/_/g' (POSIX BRE) instead
  # of 's/_\+/_/g', since '\+' is a GNU sed extension not honored by BSD
  # sed (macOS) — both forms are equivalent under GNU sed.
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/_/g' \
    | sed 's/__*/_/g' \
    | sed 's/^_//' \
    | sed 's/_$//'
}

ISSUES_DIR="docs/agents/issues"
mkdir -p "$ISSUES_DIR"

HIGHEST=0
shopt -s nullglob
for f in "${ISSUES_DIR}/${ISSUE_ID}_"[0-9][0-9]*_*; do
  base="$(basename "$f")"
  # Strip the "<issue_id>_" prefix, then take the leading digit run up to
  # the next underscore as the count segment.
  rest="${base#${ISSUE_ID}_}"
  count_segment="${rest%%_*}"
  [[ "$count_segment" =~ ^[0-9]+$ ]] || continue
  num=$((10#$count_segment))
  if (( num > HIGHEST )); then
    HIGHEST=$num
  fi
done
shopt -u nullglob

NEXT=$((HIGHEST + 1))
COUNT=$(printf '%02d' "$NEXT")

SNAKE_TITLE=$(title_to_snake_case "$TITLE")
FILE="${ISSUES_DIR}/${ISSUE_ID}_${COUNT}_${SNAKE_TITLE}.md"

{
  printf '# %s\n\n' "$TITLE"
  cat "$BODY_FILE"
} > "$FILE"

echo "FILE=$FILE"
