#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-create-branch"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/429-migrate-auto-fix-issue-create-branch-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Creates or checks out the branch
# defined in an implementation plan, via either the shell implementation
# (create_branch_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — unlike
# commit_change.sh, this entrypoint never commits (only `git show-ref`
# and `git checkout`), so it needs no identity/config resolution beyond
# engine_dispatch.sh's own defaults (PATH, ARCANUM_REPO_PATH).
#
# Usage: create_branch.sh <repo_path> <plan_dir> <id>
#
# Output and exit code: unchanged from before this migration — see
# create_branch_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
PLAN_DIR="${2:-}"
ID="${3:-}"

[[ -n "$REPO_PATH" && -n "$PLAN_DIR" && -n "$ID" ]] || {
  echo "Usage: $0 <repo_path> <plan_dir> <id>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-issue-create-branch "${SCRIPT_DIR}/create_branch_shell.sh" -- "$@"
