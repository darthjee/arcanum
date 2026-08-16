#!/usr/bin/env bash
# Migration 001 (next): offer to set a global, cross-project default for
# "git"."email" — the per-agent commit-author email pattern used by
# commit_change.sh/commit_issue.sh/commit_plan.sh (see
# arcanum/_lib/agent_email.sh) — at most once across every repo on this
# machine/account, instead of 0.14.0/002.sh's per-repo prompt. See
# 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"
# shellcheck source=../../../_lib/global_config.sh
source "${SCRIPT_DIR}/../../../_lib/global_config.sh"

cmd_config() {
  echo '{"skippable": true}'
}

# _guess_default
#   Same derivation as 0.14.0/002.sh's own _guess_default, reused
#   unchanged: prints "<local>+{agent}@<domain>", derived by splitting
#   `git config user.email` at its "@". Prints nothing if `git config
#   user.email` is empty (no local part to derive a guess from).
_guess_default() {
  local email
  email="$(git config user.email 2>/dev/null || true)"
  [[ -n "$email" ]] || return 0
  local local_part="${email%%@*}" domain="${email#*@}"
  echo "${local_part}+{agent}@${domain}"
}

# _already_configured
#   Prints "1" if "git"."email" already has a usable (non-null) value
#   somewhere this migration would otherwise touch:
#     - This repo's own local state or repo config (the two tiers
#       0.14.0/002.sh already covers) — that repo is already satisfied,
#       regardless of what 002.sh set it to.
#     - The global tier itself — some other repo already answered this
#       migration's own prompt, on this machine/account.
#   Prints nothing (and exits 0) otherwise. A JSON `null` is treated
#   the same as absent, same convention as agent_email_get.
_already_configured() {
  local email
  email=$(repo_config_read ".claude/state/arcanum-config.json" "" "git" "email")
  [[ -n "$email" && "$email" != "null" ]] && { echo 1; return; }

  email=$(repo_config_read ".claude/configuration/arcanum-repo-config.json" "" "git" "email")
  [[ -n "$email" && "$email" != "null" ]] && { echo 1; return; }

  email=$(global_config_read "." "git" "email")
  [[ -n "$email" && "$email" != "null" ]] && { echo 1; return; }
}

cmd_run() {
  if [[ -n "$(_already_configured)" ]]; then
    # Already satisfied — either this repo's own local state/repo
    # config already has a value (e.g. set by 0.14.0/002.sh), or some
    # other repo already wrote the global default. Nothing to prompt.
    return 0
  fi

  local guess
  guess="$(_guess_default)"

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs) —
    # silently write the guessed default (to the global file) if there
    # is one. If there is no guess, there is nothing to write.
    [[ -n "$guess" ]] && global_config_write "." "git" "email" "\"${guess}\""
    return 0
  fi

  if [[ -n "$guess" ]]; then
    echo "Guessed default commit-author email pattern (global, cross-project default): ${guess}"
    printf '[Y]es/[T]ype/[S]kip: '
    local choice
    read -r choice < /dev/tty
    case "$choice" in
      [Yy]*)
        global_config_write "." "git" "email" "\"${guess}\""
        ;;
      [Tt]*)
        printf 'Email pattern to use (e.g. you+{agent}@example.com): '
        local typed
        read -r typed < /dev/tty
        global_config_write "." "git" "email" "\"${typed}\""
        ;;
      *)
        # Skip — nothing written. config_chain_read's own fallthrough
        # (eventually the model's own email) applies at use-time. The
        # migration still completes successfully.
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
        global_config_write "." "git" "email" "\"${typed}\""
        ;;
      *)
        # Skip — nothing written.
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
