#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-list-plan-steps"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/432-migrate-auto-fix-issue-list-plan-steps-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Lists a specialist agent's ordered
# step files inside a plan dir, via either the shell implementation
# (list_plan_steps_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — like
# list_plan_agents.sh, this entrypoint touches no git identity/config,
# only a filesystem read.
#
# Usage: list_plan_steps.sh <plan_dir> <agent_name>
#
# Unlike create_branch.sh/commit_change.sh, this entrypoint does not take
# <repo_path> as its own argument — <plan_dir> is resolved by callers as
# an absolute or already-repo-relative path. engine_dispatch() still
# needs a repo_path for its config_chain_read call, so it is derived
# here from the ambient git checkout (the same convention
# arcanum/_lib/repo_path.sh's validation is built around) rather than
# adding a new argument.
#
# Output and exit code: unchanged from before this migration — see
# list_plan_steps_shell.sh's own header for the full behavior contract.

set -euo pipefail

PLAN_DIR="${1:-}"
AGENT_NAME="${2:-}"

[[ -n "$PLAN_DIR" && -n "$AGENT_NAME" ]] || {
  echo "Usage: $0 <plan_dir> <agent_name>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" auto-fix-issue-list-plan-steps "${SCRIPT_DIR}/list_plan_steps_shell.sh" -- "$@"
