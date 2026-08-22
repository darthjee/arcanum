#!/usr/bin/env bash
# Thin engine_dispatch shim for the
# "arcanum-split-issue-create-sub-issue-file" migrated entrypoint — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js/node.md
# for the full design/shared contracts. Creates one local sub-issue draft
# file for a parent issue being split, via either the shell implementation
# (create_sub_issue_file_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>
#
# Output and exit code: unchanged from before this migration — see
# create_sub_issue_file_shell.sh's own header for the full FILE=... contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"
TITLE="${3:-}"
BODY_FILE="${4:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" && -n "$TITLE" && -n "$BODY_FILE" ]] || {
  echo "Usage: $0 <repo_path> <issue_id> <title> <body_file>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-split-issue-create-sub-issue-file "${SCRIPT_DIR}/create_sub_issue_file_shell.sh" -- "$@"
