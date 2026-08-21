#!/usr/bin/env bash
# Thin engine_dispatch shim for the "list-agents" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/234-migrate-list-agents-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Lists specialist agents configured
# in the target project, via either the shell implementation
# (list_agents_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem-based — no environment dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Usage: list_agents.sh <repo_path> [agents_dir]
#
# Output and exit code: unchanged from before this migration — see
# list_agents_shell.sh's own header for the full contract.

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> [agents_dir]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" list-agents "${SCRIPT_DIR}/list_agents_shell.sh" -- "$@"
