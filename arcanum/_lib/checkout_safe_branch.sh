#!/usr/bin/env bash
# Thin engine_dispatch shim for the "checkout-safe-branch" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/233-migrate-checkout-safe-branch-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Enters <repo_path> and checks out
# the configured safe branch (default "origin/main", detached HEAD), via
# either the shell implementation (checkout_safe_branch_shell.sh) or the
# native one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem/git-based — no environment dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Usage: checkout_safe_branch.sh <repo_path>
#
# Output and exit code: unchanged from before this migration — see
# checkout_safe_branch_shell.sh's own header for the full contract.

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path>" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" checkout-safe-branch "${SCRIPT_DIR}/checkout_safe_branch_shell.sh" -- "$@"
