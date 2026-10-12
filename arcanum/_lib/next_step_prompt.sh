#!/usr/bin/env bash
# Thin engine_dispatch shim for the "next-step-prompt" dispatched command —
# see docs/agents/architecture/skill-finish.md and
# docs/agents/architecture/script-engine.md for the full design/contracts.
# Shows the interactive next-step offer via either the shell implementation
# (next_step_prompt_shell.sh) or the native one (core/bin/arcanum
# next-step-prompt), per engine.mode / arcanum/_lib/migration-status.json.
#
# Status `host-only`: under engine.mode=docker the command runs native on
# the host, never in the container, so it keeps the host's real /dev/tty
# for the prompt — see docs/agents/specs/docker/dispatch.md.
#
# Env forwarded to the native path: CLAUDE_CONFIG_DIR and HOME (global
# config tier of the next_step.auto.<skill> lookup) and ARCANUM_TTY_DEVICE
# (test-only TTY override).
#
# Usage:
#   next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]...
#                       [--auto-key <skill>] [--no-prompt]
#
# engine_dispatch needs the repo path up front, but this command takes it
# as the --repo flag: the shim extracts it (same flag pairing as the twin)
# and forwards "$@" unchanged, without --prepend-repo-path. With no --repo,
# a malformed argument list, or a --repo value that is not a directory, it
# execs the shell twin directly, so usage errors are identical in every
# mode.
#
# Output and exit code: see next_step_prompt_shell.sh's own header for the
# full contract (exit 0/3/4 on an answer or fallback, exit 1 with nothing
# on stdout on any usage error).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELL_TWIN="${SCRIPT_DIR}/next_step_prompt_shell.sh"

_find_repo_path() {
  local repo=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo|--command|--auto-key)
        [[ $# -ge 2 ]] || return 1
        [[ "$1" == "--repo" ]] && repo="$2"
        shift 2
        ;;
      --no-prompt) shift 1 ;;
      *) return 1 ;;
    esac
  done
  [[ -n "$repo" && -d "$repo" ]] || return 1
  printf '%s\n' "$repo"
}

REPO_PATH="$(_find_repo_path "$@")" || exec "$SHELL_TWIN" "$@"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" next-step-prompt "$SHELL_TWIN" \
  CLAUDE_CONFIG_DIR HOME ARCANUM_TTY_DEVICE -- "$@"
