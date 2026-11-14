#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-ensure-coauthor-policy"
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/911-make-the-co-author-config-override-claude-code-s-attribution-reminder-in-agents-md/plan.md
# for the full design/shared contracts. Appends the fixed co-author policy
# line (under a "## Commit Attribution" heading) to <repo_path>/AGENTS.md
# when missing. Called by init-claude and by migration next/004.
#
# Native-only: this command has NO shell implementation (no *_shell.sh
# twin). It is dispatched with `engine_dispatch --native-only`, so it never
# runs a shell twin: under engine.mode=shell or native it runs
# core/bin/arcanum on the host. Under engine.mode=docker it runs inside the
# container (status `"docker"`) with only the repo mount (no `--needs`); if
# docker is unavailable, engine_dispatch falls back to native on the host
# with a warning — see docs/agents/architecture/docker-engine.md#fallback-rules.
#
# <repo_path> is forwarded as the first native argument, where the
# `context: 'repo'` dispatcher consumes it, so --prepend-repo-path is not
# used.
#
# Usage: ensure_coauthor_policy.sh <repo_path>
#
# Output and exit code: passed through unchanged from core/bin/arcanum
# init-claude-ensure-coauthor-policy (`COAUTHOR_POLICY=<no-agents-md|present|added>`
# on stdout, exit 0; `arcanum: <message>` on stderr, exit 1). A missing
# argument is rejected here, before dispatch (usage on stderr, exit 1).

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || {
  echo "Usage: $0 <repo_path>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" init-claude-ensure-coauthor-policy "" --native-only -- "$REPO_PATH"
