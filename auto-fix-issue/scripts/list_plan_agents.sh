#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-list-plan-agents"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/431-migrate-auto-fix-issue-list-plan-agents-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Lists the specialist agents that
# have their own plan file in a plan dir, via either the shell
# implementation (list_plan_agents_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — like
# create_branch.sh, this entrypoint touches no git identity/config, only
# a filesystem read.
#
# Usage: list_plan_agents.sh <plan_dir>
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
# list_plan_agents_shell.sh's own header for the full behavior contract.

set -euo pipefail

PLAN_DIR="${1:-}"

[[ -n "$PLAN_DIR" ]] || {
  echo "Usage: $0 <plan_dir>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" auto-fix-issue-list-plan-agents "${SCRIPT_DIR}/list_plan_agents_shell.sh" -- "$@"
