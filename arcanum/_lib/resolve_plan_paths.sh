#!/usr/bin/env bash
# Thin engine_dispatch shim for the "resolve-plan-paths" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/235-migrate-resolve-plan-paths-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Resolves the issue file and plan
# dir/file for a given issue ID, via either the shell implementation
# (resolve_plan_paths_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem-based — no gh/GitHub API dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Usage: resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>
#
# Output (key=value lines) and exit code: unchanged from before this
# migration — see resolve_plan_paths_shell.sh's own header for the full
# ISSUE_FILE=/PLAN_DIR=/PLAN_FILE=/PLAN_EXISTS= contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUES_FOLDER="${2:-}"
PLANS_FOLDER="${3:-}"
ID="${4:-}"

[[ -n "$REPO_PATH" && -n "$ISSUES_FOLDER" && -n "$PLANS_FOLDER" && -n "$ID" ]] || {
  echo "Usage: $0 <repo_path> <issues_folder> <plans_folder> <id>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-plan-paths "${SCRIPT_DIR}/resolve_plan_paths_shell.sh" -- "$@"
