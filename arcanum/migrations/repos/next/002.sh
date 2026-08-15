#!/usr/bin/env bash
# Migration 002 (next): seed .claude/state/arcanum-config.json's
# "git"."email" key — the per-agent "Co-Authored-By" email pattern used
# by commit_change.sh/commit_issue.sh/commit_plan.sh (see
# arcanum/_lib/agent_email.sh) once a repo has opted into the new
# commit message template. See 002.md for a human-readable summary.
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

# _guess_default
#   Prints "<local>+{agent}@<domain>", derived by splitting `git config
#   user.email` at its "@". Prints nothing if `git config user.email`
#   is empty (no local part to derive a guess from).
_guess_default() {
  local email
  email="$(git config user.email 2>/dev/null || true)"
  [[ -n "$email" ]] || return 0
  local local_part="${email%%@*}" domain="${email#*@}"
  echo "${local_part}+{agent}@${domain}"
}

cmd_run() {
  local guess
  guess="$(_guess_default)"

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs) —
    # silently write the guessed default, no prompt. If there is no
    # guess (no `git config user.email` to derive from), there is
    # nothing to write.
    [[ -n "$guess" ]] && repo_config_write ".claude/state/arcanum-config.json" "" "git" "email" "\"${guess}\""
    return 0
  fi

  if [[ -n "$guess" ]]; then
    echo "Guessed default commit-author email pattern: ${guess}"
    printf '[Y]es/[T]ype/[S]kip: '
    local choice
    read -r choice < /dev/tty
    case "$choice" in
      [Yy]*)
        repo_config_write ".claude/state/arcanum-config.json" "" "git" "email" "\"${guess}\""
        ;;
      [Tt]*)
        printf 'Email pattern to use (e.g. you+{agent}@example.com): '
        local typed
        read -r typed < /dev/tty
        repo_config_write ".claude/state/arcanum-config.json" "" "git" "email" "\"${typed}\""
        ;;
      *)
        # Skip — nothing written. agent_email_get's own fallback (the
        # model's own email) applies at use-time. The migration still
        # completes successfully.
        ;;
    esac
  else
    printf '[T]ype/[S]kip: '
    local choice
    read -r choice < /dev/tty
    case "$choice" in
      [Tt]*)
        printf 'Email pattern to use (e.g. you+{agent}@example.com): '
        local typed
        read -r typed < /dev/tty
        repo_config_write ".claude/state/arcanum-config.json" "" "git" "email" "\"${typed}\""
        ;;
      *)
        # Skip — nothing written. agent_email_get's own fallback (the
        # model's own email) applies at use-time. The migration still
        # completes successfully.
        ;;
    esac
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
