#!/usr/bin/env bash
# Migration 001 (next): seed .claude/state/arcanum-config.json's
# "git"."safe_branch" key, used by enhance-issue/discuss-issue/
# arcanum-split-issue to release "issue-<id>" branches back to a safe
# parking spot in shared-.git multi-agent workspaces (see
# arcanum/_lib/safe_branch.sh). See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run
#
# The "config" subcommand is unused by this manifest-driven entry
# (migrations.json already carries "skippable": true) — kept as a stub
# only for legacy-compatibility, matching migration 001's shape in
# earlier version folders (e.g. 0.9.3/001.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

# _guess_default
#   Prints "<remote>/main" — <remote> is the first name `git remote`
#   lists, falling back to "origin" when there is no remote configured
#   at all. The branch half is always "main".
_guess_default() {
  local remote
  remote="$(git remote 2>/dev/null | head -1)"
  [[ -n "$remote" ]] || remote="origin"
  echo "${remote}/main"
}

cmd_run() {
  local guess
  guess="$(_guess_default)"

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs) —
    # silently write the guessed default, no prompt.
    repo_config_write ".claude/state/arcanum-config.json" "" "git" "safe_branch" "\"${guess}\""
    return 0
  fi

  echo "Guessed default safe branch: ${guess}"
  printf '[Y]es/[T]ype/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*)
      repo_config_write ".claude/state/arcanum-config.json" "" "git" "safe_branch" "\"${guess}\""
      ;;
    [Tt]*)
      printf 'Branch to use (e.g. origin/main): '
      local typed
      read -r typed < /dev/tty
      repo_config_write ".claude/state/arcanum-config.json" "" "git" "safe_branch" "\"${typed}\""
      ;;
    *)
      # Skip — nothing written. safe_branch.sh's own hardcoded fallback
      # ("origin/main") applies at use-time. The migration still
      # completes successfully.
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
