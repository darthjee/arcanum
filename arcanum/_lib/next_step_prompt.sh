#!/usr/bin/env bash
# Interactive next-step offer shown by interactive issue skills after
# their closing report — see docs/agents/architecture/skill-finish.md
# for the full design/contracts. Plain bash, NOT engine-dispatched: it owns the
# prompt on /dev/tty (the arcanum/migrations/run.sh convention), never a
# chat-mediated yes/no.
#
# Usage:
#   next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]...
#
# Prompt (written to /dev/tty, never stdout):
#   one command:   Next step: <cmd>
#   several:       Next steps:
#                    <cmd1>
#                    <cmd2>
#   then:          Run it now? [Y]es / [N]o / [C]hat:
# Input is read from /dev/tty, case-insensitive: y|yes, n|no, c|chat.
# Anything else re-prompts.
#
# Output (stdout) and exit code:
#   [Y]es  -> CHOICE=yes                            exit 0
#   [N]o   -> CHOICE=no                             exit 0
#   [C]hat -> CHOICE=chat, CHAT_CONTEXT=next_step   exit 3
#   usage error, --repo not a directory, /dev/tty unreadable (or closed
#   before a valid answer) -> nothing on stdout, error on stderr, exit 1

set -euo pipefail

TTY_DEVICE="/dev/tty"

_usage_error() {
  echo "Error: $1" >&2
  echo "Usage: $0 --repo <repo_path> --command \"<command>\" [--command \"<command>\"]..." >&2
  exit 1
}

REPO_PATH=""
COMMANDS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo|--command)
      [[ $# -ge 2 ]] || _usage_error "$1 requires a value"
      if [[ "$1" == "--repo" ]]; then
        REPO_PATH="$2"
      else
        [[ -n "$2" ]] || _usage_error "--command must not be empty"
        COMMANDS+=("$2")
      fi
      shift 2
      ;;
    *)
      _usage_error "unknown argument '$1'"
      ;;
  esac
done

[[ -n "$REPO_PATH" ]] || _usage_error "--repo is required"
[[ -d "$REPO_PATH" ]] || _usage_error "--repo '$REPO_PATH' is not a directory"
[[ ${#COMMANDS[@]} -gt 0 ]] || _usage_error "at least one --command is required"

if ! ( exec 3< "$TTY_DEVICE" ) 2>/dev/null; then
  echo "Error: no interactive terminal ($TTY_DEVICE) available to prompt for the next step." >&2
  exit 1
fi

{
  if [[ ${#COMMANDS[@]} -eq 1 ]]; then
    printf 'Next step: %s\n' "${COMMANDS[0]}"
  else
    printf 'Next steps:\n'
    for cmd in "${COMMANDS[@]}"; do
      printf '  %s\n' "$cmd"
    done
  fi
} > "$TTY_DEVICE"

while true; do
  printf 'Run it now? [Y]es / [N]o / [C]hat: ' > "$TTY_DEVICE"
  choice=""
  if ! read -r choice < "$TTY_DEVICE"; then
    [[ -n "$choice" ]] || {
      echo "Error: $TTY_DEVICE closed before a valid answer was given." >&2
      exit 1
    }
  fi
  choice="$(printf '%s' "$choice" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  case "$choice" in
    y|yes)
      echo "CHOICE=yes"
      exit 0
      ;;
    n|no)
      echo "CHOICE=no"
      exit 0
      ;;
    c|chat)
      echo "CHOICE=chat"
      echo "CHAT_CONTEXT=next_step"
      exit 3
      ;;
  esac
done
