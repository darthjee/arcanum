#!/usr/bin/env bash
# Shell implementation of the "monitor-issues-github-remove-tag" migrated
# entrypoint — invoked by github.sh's engine_dispatch shim.
# Removes a single tag from GitHub issue <id>, mapped to a real GitHub
# label via the canonical-tag/label-name table in `arcanum/_lib/tags.sh`.
# Usage: github_remove_tag_shell.sh <repo_path> <id> <tag>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/origin.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/origin.sh"
# shellcheck source=../../arcanum/_lib/tags.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/tags.sh"
# shellcheck source=../../arcanum/_lib/tag_mutate.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/tag_mutate.sh"

cmd_remove_tag() {
  local repo_path="${1:-}" id="${2:-}" tag="${3:-}"
  [[ -n "$repo_path" && -n "$id" && -n "$tag" ]] || {
    echo "Usage: $0 remove-tag <repo_path> <id> <tag>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref "$repo_path")

  tag_mutate_remove_label "$id" "$repo_ref" "$tag" || exit 1
}

cmd_remove_tag "$@"
