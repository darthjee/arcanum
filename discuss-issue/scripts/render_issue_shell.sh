#!/usr/bin/env bash
# Render the issue template (../templates/issue.tmpl.md) into a file.
# Usage: render_issue.sh <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]
#
# Each section argument is the full block including its own "## Heading"
# line (e.g. "## Description\nSome text"); pass "" to omit a section
# entirely.
#
# Collapses the blank lines left behind by omitted sections down to a
# single blank line, and trims leading/trailing blank lines.
#
# Placeholders are substituted in one perl pass reading values from env
# vars, not with bash's ${var/pattern/replacement}: on bash >= 5.2
# (patsub_replacement) an unquoted "&" in the replacement expands to the
# matched text and "\\" is consumed, and chained substitutions would also
# re-scan earlier values for later placeholders.

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

[[ -n "$OUTPUT_FILE" && -n "$TITLE" ]] || {
  echo "Usage: $0 <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]" >&2
  exit 1
}

# Single-pass substitution: each value is inserted verbatim and never
# re-scanned, so "$", "&", "\\" and "%%NAME%%" inside a value stay literal.
content=$(R_TITLE="$TITLE" R_DESCRIPTION="$DESCRIPTION" R_PROBLEM="$PROBLEM" \
  R_EXPECTED_BEHAVIOR="$EXPECTED_BEHAVIOR" R_SOLUTION="$SOLUTION" R_BENEFITS="$BENEFITS" \
  perl -0777 -pe 's/%%(TITLE|DESCRIPTION|PROBLEM|EXPECTED_BEHAVIOR|SOLUTION|BENEFITS)%%/$ENV{"R_$1"}/g' "$TEMPLATE")

# Collapse 3+ blank lines (left by omitted sections) down to 1 blank line,
# then trim leading/trailing blank lines.
content=$(printf '%s\n' "$content" | perl -0777 -pe 's/\A\n+//; s/\n+\z/\n/; s/\n{3,}/\n\n/g')

printf '%s\n' "$content" > "$OUTPUT_FILE"
