#!/usr/bin/env bash
# Detect a "shipit" tag in an issue file's body.
# Usage: has_shipit_tag.sh <issue_file>
#   Reads <issue_file> (path relative to cwd, the target project root),
#   and checks whether `:shipit:` appears anywhere in the file content.
#   Exits 0 if :shipit: is present (case-insensitive), else exits 1
#   (including when the file doesn't exist).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"

cmd_main() {
  local file="${1:-}"
  [[ -n "$file" ]] || { echo "Usage: $0 <issue_file>" >&2; exit 1; }
  [[ -f "$file" ]] || exit 1

  local content
  content=$(cat "$file")

  has_tag "$content" "shipit"
}

cmd_main "$@"
