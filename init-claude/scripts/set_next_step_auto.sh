#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-set-next-step-auto"
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/716-auto-next-init-claude-migrations-remove-spec/plan.md
# for the full design/shared contracts. Writes next_step.auto.<skill>
# (true|false) into <repo_path>/.claude/configuration/arcanum-repo-config.json,
# creating the file and its folder when missing. Called by
# init-claude/setup_auto_next.md.
#
# Native-only: this command has NO shell implementation (no *_shell.sh
# twin). It is listed in arcanum/_lib/migration-status.json with a
# non-`shell` status, but never falls back to a shell twin. It is
# dispatched with `engine_dispatch --native-only`, which always runs
# core/bin/arcanum (except engine.mode=docker, which errors out).
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint only writes a config file under the target project.
#
# <repo_path> is forwarded as the first native argument, where the
# `context: 'repo'` dispatcher consumes it, so --prepend-repo-path is not
# used.
#
# Usage: set_next_step_auto.sh <repo_path> <skill> <true|false>
#   <skill>: enhance-issue | discuss-issue | auto-plan-issue
#
# Output and exit code: passed through unchanged from core/bin/arcanum
# init-claude-set-next-step-auto (`NEXT_STEP_AUTO=<skill>=<true|false>`
# on stdout, exit 0; `arcanum: <message>` on stderr, exit 1, for an
# unknown skill or a bad value) or from engine_dispatch's docker error.
# A missing argument is rejected here, before dispatch (usage on stderr,
# exit 1).

set -euo pipefail

REPO_PATH="${1:-}"
SKILL="${2:-}"
VALUE="${3:-}"

[[ -n "$REPO_PATH" && -n "$SKILL" && -n "$VALUE" ]] || {
  echo "Usage: $0 <repo_path> <skill> <true|false>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" init-claude-set-next-step-auto "" --native-only -- "$REPO_PATH" "$SKILL" "$VALUE"
