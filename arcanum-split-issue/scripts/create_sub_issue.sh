#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-split-issue-create-sub-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Creates one sub-issue on GitHub from
# a local sub-issue draft file, via either the shell implementation
# (create_sub_issue_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# HOME is forwarded to the native path's explicit env-var allowlist — the
# native implementation calls `gh` in-process (via SpawnIssue) and needs it
# to resolve credentials once native's `env -i PATH="$PATH"` strips the
# ambient environment; mirrors arcanum/_lib/spawn_issue.sh's own shim.
#
# Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>
#
# Output and exit code: unchanged from before this migration — see
# create_sub_issue_shell.sh's own header for the full STATUS=ok/ID=.../
# STATUS=failed contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"
SUB_ISSUE_FILE="${3:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" && -n "$SUB_ISSUE_FILE" ]] || {
  echo "Usage: $0 <repo_path> <issue_id> <sub_issue_file>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-split-issue-create-sub-issue "${SCRIPT_DIR}/create_sub_issue_shell.sh" HOME -- "$@"
