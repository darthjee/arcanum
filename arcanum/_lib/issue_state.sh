#!/usr/bin/env bash
# Thin engine_dispatch shim for the "issue-state" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/238-migrate-issue-state-entrypoint-to-native-node-js/plan.md.
#
# Usage: issue_state.sh <repo_path> get <id> <field>
#        issue_state.sh <repo_path> set <id> <field> <value>
#        issue_state.sh <repo_path> set-json <id> <field> <json_value>
#        issue_state.sh <repo_path> append-json <id> <field> <json_value>

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> get|set|set-json|append-json <id> <field> [value]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" issue-state "${SCRIPT_DIR}/issue_state_shell.sh" -- "$@"
