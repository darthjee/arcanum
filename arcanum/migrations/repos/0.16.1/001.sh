#!/usr/bin/env bash
# Migration 001 (next): seed .claude/state/arcanum-config.json's
# "git"."merge_body_mode" key — controls the squash-merge commit body
# `cmd_pr_merge` (auto-fix-all/scripts/github.sh) uses, via
# arcanum/_lib/merge_body.sh. See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs) —
    # there is no derivable default to guess (unlike git.email), so
    # silently skip, writing nothing. merge_body_mode()'s own hardcoded
    # default ("empty") applies at use-time.
    return 0
  fi

  echo "This controls the body of the commit created when auto-fix-all squash-merges a PR:"
  echo "  [E]mpty     - no body (today's behavior)"
  echo "  [F]ull      - let GitHub/gh pick its own default squash body"
  echo "  [C]oauthors - a deduped Co-authored-by: block from the PR's commits"
  printf '[E]mpty/[F]ull/[C]oauthors/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Ee]*)
      repo_config_write ".claude/state/arcanum-config.json" "" "git" "merge_body_mode" '"empty"'
      ;;
    [Ff]*)
      repo_config_write ".claude/state/arcanum-config.json" "" "git" "merge_body_mode" '"full"'
      ;;
    [Cc]*)
      repo_config_write ".claude/state/arcanum-config.json" "" "git" "merge_body_mode" '"coauthors"'
      ;;
    *)
      # Skip — nothing written. merge_body_mode()'s own hardcoded default
      # ("empty") applies at use-time. The migration still completes
      # successfully.
      ;;
  esac
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
