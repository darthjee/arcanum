#!/usr/bin/env bash
# GitHub operations script for monitor-issues
# Usage: github.sh <command> [args]
#   remove-tag <id> <tag>   Remove a single tag (colon or emoji form) from
#                           GitHub issue <id>'s trailing `Tags:` line, and
#                           push the updated body via `gh issue edit`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib_origin.sh
source "${SCRIPT_DIR}/_lib_origin.sh"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"
# shellcheck source=../../_lib/tag_mutate.sh
source "${SCRIPT_DIR}/../../_lib/tag_mutate.sh"

cmd_remove_tag() {
  local id="${1:-}" tag="${2:-}"
  [[ -n "$id" && -n "$tag" ]] || {
    echo "Usage: $0 remove-tag <id> <tag>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  tag_mutate_fetch_and_push "$id" "$repo_ref" tag_mutate_remove "$tag" || exit 1
}

case "${1:-}" in
  remove-tag) shift; cmd_remove_tag "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  remove-tag <id> <tag>   Remove a single tag (colon or emoji form) from GitHub issue <id>'s trailing 'Tags:' line" >&2
    exit 1
    ;;
esac
