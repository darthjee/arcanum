#!/usr/bin/env bash
# Interactive next-step offer shown by interactive issue skills after
# their closing report — see docs/agents/architecture/skill-finish.md
# for the full design/contracts. Plain bash, NOT engine-dispatched: it owns the
# prompt on /dev/tty (the arcanum/migrations/run.sh convention). When /dev/tty
# cannot be opened (e.g. inside a Claude Code session) it does not prompt and
# instead signals the calling skill to ask via AskUserQuestion — the
# "TTY-first with AskUserQuestion fallback" convention documented in
# docs/agents/architecture/skill-finish.md.
#
# Usage:
#   next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]...
#                       [--auto-key <skill>] [--no-prompt]
#
# Auto mode and --no-prompt (evaluated after validation, before the TTY probe):
#   --auto-key <skill>  reads next_step.auto.<skill> through the 3-tier config
#                       chain (config_chain.sh: local state -> repo config ->
#                       global; local/repo tiers resolved under --repo). Only
#                       the exact JSON value `true` enables it; absent, null,
#                       false, "true" (string) or anything else is disabled.
#                       When enabled: the notice
#                         auto-continuing: <first --command> (next_step.auto.<skill>=true)
#                       goes to stderr, CHOICE=yes and AUTO=true go to stdout,
#                       exit 0 — /dev/tty is never probed (with or without
#                       --no-prompt).
#   --no-prompt         when auto mode did not fire, print CHOICE=no and exit 0
#                       without probing /dev/tty or prompting.
#   Neither applies     today's behavior, unchanged (TTY prompt or fallback).
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
#   auto-key enabled -> CHOICE=yes, AUTO=true       exit 0
#   --no-prompt      -> CHOICE=no                   exit 0
#   [Y]es  -> CHOICE=yes                            exit 0
#   [N]o   -> CHOICE=no                             exit 0
#   [C]hat -> CHOICE=chat, CHAT_CONTEXT=next_step   exit 3
#   /dev/tty cannot be opened -> FALLBACK=chat, then one COMMAND=<cmd> line
#   per --command (verbatim, in the order given)    exit 4
#   usage error, --repo not a directory, or /dev/tty closed before a valid
#   answer -> nothing on stdout, error on stderr, exit 1
# Argument validation (including an empty --auto-key value) runs before any
# config read or TTY probe, so usage errors exit 1 even when no TTY is
# available and regardless of configuration.
#
# Environment:
#   ARCANUM_TTY_DEVICE  TEST-ONLY override of the TTY device path (defaults to
#                       /dev/tty). Not a user-facing setting; specs point it at
#                       a nonexistent path to simulate "no TTY".

set -euo pipefail

# Test-only override (see header); not a user-facing setting.
TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"

_usage_error() {
  echo "Error: $1" >&2
  echo "Usage: $0 --repo <repo_path> --command \"<command>\" [--command \"<command>\"]... [--auto-key <skill>] [--no-prompt]" >&2
  exit 1
}

REPO_PATH=""
COMMANDS=()
AUTO_KEY=""
AUTO_KEY_SET=false
NO_PROMPT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo|--command|--auto-key)
      [[ $# -ge 2 ]] || _usage_error "$1 requires a value"
      case "$1" in
        --repo)
          REPO_PATH="$2"
          ;;
        --command)
          [[ -n "$2" ]] || _usage_error "--command must not be empty"
          COMMANDS+=("$2")
          ;;
        --auto-key)
          [[ -n "$2" ]] || _usage_error "--auto-key must not be empty"
          AUTO_KEY="$2"
          AUTO_KEY_SET=true
          ;;
      esac
      shift 2
      ;;
    --no-prompt)
      NO_PROMPT=true
      shift 1
      ;;
    *)
      _usage_error "unknown argument '$1'"
      ;;
  esac
done

[[ -n "$REPO_PATH" ]] || _usage_error "--repo is required"
[[ -d "$REPO_PATH" ]] || _usage_error "--repo '$REPO_PATH' is not a directory"
[[ ${#COMMANDS[@]} -gt 0 ]] || _usage_error "at least one --command is required"

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_chain.sh
source "${LIB_DIR}/config_chain.sh"

if [[ "$AUTO_KEY_SET" == "true" ]]; then
  # Local/repo tiers are cwd-relative, so resolve them under --repo. Any
  # failure or empty result means "disabled" — never abort here.
  auto_value="$(cd "$REPO_PATH" && config_chain_read "$REPO_PATH" next_step "auto.${AUTO_KEY}" 2>/dev/null || true)"
  if [[ "$auto_value" == "true" ]]; then
    printf 'auto-continuing: %s (next_step.auto.%s=true)\n' "${COMMANDS[0]}" "$AUTO_KEY" >&2
    echo "CHOICE=yes"
    echo "AUTO=true"
    exit 0
  fi
fi

if [[ "$NO_PROMPT" == "true" ]]; then
  echo "CHOICE=no"
  exit 0
fi

if ! ( exec 3< "$TTY_DEVICE" ) 2>/dev/null; then
  echo "FALLBACK=chat"
  for cmd in "${COMMANDS[@]}"; do
    printf 'COMMAND=%s\n' "$cmd"
  done
  exit 4
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
