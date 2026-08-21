#!/usr/bin/env bash
# Thin engine_dispatch shim for the "resolve-id-and-file" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/227-migrat-next-entry-point-to-use-native-nodejs/plan.md
# for the full design/shared contracts. Resolves issue ID, title, and
# filename from skill arguments and the local issues folder, via either
# the shell implementation (resolve_id_and_file_shell.sh) or the native
# one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem-based — no gh/GitHub API dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Usage: resolve_id_and_file.sh <repo_path> <issues_folder> [arg_string]
#
# Output (key=value lines) and exit code: unchanged from before this
# migration — see resolve_id_and_file_shell.sh's own header for the full
# SCENARIO=/STATUS= contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUES_FOLDER="${2:-}"

[[ -n "$ISSUES_FOLDER" ]] || { echo "Usage: $0 <repo_path> <issues_folder> [arg_string]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-id-and-file "${SCRIPT_DIR}/resolve_id_and_file_shell.sh" -- "$@"
