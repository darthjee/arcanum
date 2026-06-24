#!/usr/bin/env bash
# Render the issue template (../templates/issue.tmpl.md) into a file.
# Usage: render_issue.sh <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits] [tags_block]
#
# Each section argument is the full block including its own "## Heading"
# line (e.g. "## Description\nSome text"); pass "" to omit a section
# entirely. tags_block, when non-empty, is the raw "Tags: ..." line(s) (no
# leading "---") — the script adds the separator itself.
#
# Collapses the blank lines left behind by omitted sections down to a
# single blank line, and trims leading/trailing blank lines.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../templates/issue.tmpl.md"

OUTPUT_FILE="${1:-}"
TITLE="${2:-}"
DESCRIPTION="${3:-}"
PROBLEM="${4:-}"
EXPECTED_BEHAVIOR="${5:-}"
SOLUTION="${6:-}"
BENEFITS="${7:-}"
TAGS_BLOCK="${8:-}"

[[ -n "$OUTPUT_FILE" && -n "$TITLE" ]] || {
  echo "Usage: $0 <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits] [tags_block]" >&2
  exit 1
}

content=$(cat "$TEMPLATE")
content="${content/\%\%TITLE\%\%/$TITLE}"
content="${content/\%\%DESCRIPTION\%\%/$DESCRIPTION}"
content="${content/\%\%PROBLEM\%\%/$PROBLEM}"
content="${content/\%\%EXPECTED_BEHAVIOR\%\%/$EXPECTED_BEHAVIOR}"
content="${content/\%\%SOLUTION\%\%/$SOLUTION}"
content="${content/\%\%BENEFITS\%\%/$BENEFITS}"

# Collapse 3+ blank lines (left by omitted sections) down to 1 blank line,
# then trim leading/trailing blank lines.
content=$(printf '%s\n' "$content" | perl -0777 -pe 's/\A\n+//; s/\n+\z/\n/; s/\n{3,}/\n\n/g')

if [[ -n "$TAGS_BLOCK" ]]; then
  printf '%s\n\n---\n\n%s\n' "$content" "$TAGS_BLOCK" > "$OUTPUT_FILE"
else
  printf '%s\n' "$content" > "$OUTPUT_FILE"
fi
