#!/usr/bin/env bash
# Migration 001 (next): create the `Epic:fbca04` label on the repo's live
# GitHub labels if it is missing (issue #689), so `mark-split` (called by
# arcanum-split-issue's finish step) can add the `epic` tag to a split
# parent. Create-only: an existing label (matched case-insensitively) is
# left untouched — never edited. The init-claude-config.json upsert is
# migration 002's job (that file is git-ignored, so it is per-checkout).
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/origin.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../../_lib/origin.sh"

LABEL_NAME="Epic"
LABEL_COLOR="fbca04"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  local repo_ref
  repo_ref="$(get_repo_ref ".")"

  local existing
  existing="$(gh label list -R "$repo_ref" --json name -q '.[].name')"

  # GitHub label names are unique case-insensitively, so match existing
  # names case-insensitively too (same logic as init-claude's
  # sync_labels.sh).
  if grep -qixF "$LABEL_NAME" <<< "$existing"; then
    echo "'${LABEL_NAME}' label already present on ${repo_ref}."
    return 0
  fi

  gh label create "$LABEL_NAME" -R "$repo_ref" --color "$LABEL_COLOR" >/dev/null
  echo "Created '${LABEL_NAME}' label on ${repo_ref}."
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
