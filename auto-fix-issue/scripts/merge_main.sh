#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-merge-main" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/433-migrate-auto-fix-issue-merge-main-entrypoint-to-native-node-js/node.md
# for the full design/shared contracts. Merges origin/main into the
# currently checked-out issue branch, via either the shell implementation
# (merge_main_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint only reads/writes the repo's .git (fetch + merge), it never
# touches commit identity or GitHub credentials, so it needs no
# identity/config resolution beyond engine_dispatch.sh's own defaults
# (PATH, ARCANUM_REPO_PATH).
#
# Usage: merge_main.sh <repo_path>
#
# Output and exit code: unchanged from before this migration — see
# merge_main_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || {
  echo "Usage: $0 <repo_path>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-issue-merge-main "${SCRIPT_DIR}/merge_main_shell.sh" -- "$@"
