#!/usr/bin/env bash
# Migration 001 (next): create/update the `Spawned:6a737d` label directly
# on the repo's live GitHub labels, so spawn_issue.sh's
# `gh issue edit --add-label Spawned` (see arcanum/_lib/spawn_issue.sh
# and issue #174) succeeds on repos that ran init-claude's label setup
# before this label existed. See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/origin.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../../_lib/origin.sh"

LABEL_NAME="Spawned"
LABEL_COLOR="6a737d"
INIT_CLAUDE_CONFIG=".claude/state/init-claude-config.json"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  # No /dev/tty confirmation prompt — unlike the shipit-permission
  # migrations, adding a label is fully additive/reversible, so this
  # runs silently in both interactive and non-interactive contexts.
  echo "Syncing the '${LABEL_NAME}' label (#${LABEL_COLOR}) to this repo's live GitHub labels..."

  local repo_ref
  repo_ref="$(get_repo_ref ".")"

  local existing
  existing="$(gh label list -R "$repo_ref" --json name -q '.[].name')"

  # GitHub label names are unique case-insensitively, so match existing
  # names case-insensitively too (same logic as init-claude's
  # sync_labels.sh) — otherwise a same-name-different-case label is
  # missed and `create` fails on the case-insensitive collision instead
  # of updating it.
  local existing_name
  existing_name="$(grep -ixF "$LABEL_NAME" <<< "$existing" || true)"

  if [[ -n "$existing_name" ]]; then
    gh label edit "$existing_name" -R "$repo_ref" --name "$LABEL_NAME" --color "$LABEL_COLOR" >/dev/null
    echo "Updated '${LABEL_NAME}' label on ${repo_ref}."
  else
    gh label create "$LABEL_NAME" -R "$repo_ref" --color "$LABEL_COLOR" >/dev/null
    echo "Created '${LABEL_NAME}' label on ${repo_ref}."
  fi

  # If this repo already ran init-claude's label setup, keep its config
  # in sync too, so a future manual sync_labels.sh re-run stays
  # consistent. If the config doesn't exist, this is simply skipped.
  if [[ -f "$INIT_CLAUDE_CONFIG" ]]; then
    local write_label_config="${SCRIPT_DIR}/../../../../init-claude/scripts/write_label_config.sh"
    "$write_label_config" add "$INIT_CLAUDE_CONFIG" "${LABEL_NAME}:${LABEL_COLOR}"
    echo "Upserted '${LABEL_NAME}:${LABEL_COLOR}' into ${INIT_CLAUDE_CONFIG}."
  fi
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
