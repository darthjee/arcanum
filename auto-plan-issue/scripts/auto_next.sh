#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-plan-issue-auto-next" dispatched
# command — see docs/agents/architecture/skill-finish.md#next-step-map and
# docs/agents/architecture/script-engine.md for the full design/contracts.
# Decides whether a top-level auto-plan-issue run chains into
# /auto-resolve-issue via either the shell implementation
# (auto_next_shell.sh) or the native one (core/bin/arcanum
# auto-plan-issue-auto-next), per engine.mode /
# arcanum/_lib/migration-status.json.
#
# Status `host-only`: under engine.mode=docker the command runs native on
# the host, never in the container, so its `git push` uses the host's git
# credentials — see docs/agents/architecture/docker-engine.md#resolution-order.
#
# Env forwarded to the native path: CLAUDE_CONFIG_DIR and HOME (global
# config tier of next_step.auto.auto-plan-issue), ARCANUM_TTY_DEVICE
# (test-only TTY override), and GIT_CONFIG_GLOBAL, SSH_AUTH_SOCK and
# GIT_SSH_COMMAND so the host-side push can authenticate (SSH_AUTH_SOCK
# lets an ssh push use the SSH agent).
#
# Usage: auto_next.sh <repo_path> <id>
#
# "$@" is forwarded as-is (repo path first, then <id>), without
# --prepend-repo-path. With a missing argument or a <repo_path> that is not
# a directory, the shim execs the shell twin directly, so usage errors are
# identical in every mode.
#
# Output and exit code: see auto_next_shell.sh's own header for the full
# contract (CHAIN=yes, optionally followed by CLEAR=true / CHAIN=no +
# REASON=... with exit 0, exit 1 with
# nothing on stdout on any usage error).

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELL_TWIN="${SCRIPT_DIR}/auto_next_shell.sh"

[[ -n "$REPO_PATH" && -n "$ID" && -d "$REPO_PATH" ]] || exec "$SHELL_TWIN" "$@"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-plan-issue-auto-next "$SHELL_TWIN" \
  CLAUDE_CONFIG_DIR HOME ARCANUM_TTY_DEVICE GIT_CONFIG_GLOBAL SSH_AUTH_SOCK GIT_SSH_COMMAND -- "$@"
