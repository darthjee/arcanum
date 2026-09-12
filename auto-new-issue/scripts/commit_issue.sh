#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-new-issue-commit-issue" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js/node.md
# for the full design/shared contracts. Stages and commits an issue file
# created by the auto-new-issue skill, via either the shell implementation
# (commit_issue_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# HOME is forwarded to the native path's explicit env-var allowlist — git
# (called throughout the shell implementation) needs it to resolve
# identity/config once native's `env -i PATH="$PATH"` strips the ambient
# environment down.
#
# Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>
#
# Output and exit code: unchanged from before this migration — see
# commit_issue_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
FILE_PATH="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$REPO_PATH" && -n "$FILE_PATH" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <file_path> <id> <model_name> <model_email>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-new-issue-commit-issue "${SCRIPT_DIR}/commit_issue_shell.sh" HOME -- "$@"
