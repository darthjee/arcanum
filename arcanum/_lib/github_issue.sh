#!/usr/bin/env bash
# Thin per-sub-command engine_dispatch shim for the "github-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md
# and docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/plan.md
# for the full design/shared contracts. Only `info`/`create` route
# through engine_dispatch; `fetch`/`update`/`mark-*` call the shell
# implementation directly, unchanged — they have no migration-status.json
# key yet, so dispatching them through engine_dispatch would only add a
# pointless always-false lookup (and print its "no native implementation
# yet" warning on every single call, forever, until their own sub-issues
# land).
#
# Usage: github_issue.sh <command> [args...]  (unchanged from before)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { echo "Usage: $0 <command> [args]" >&2; exit 1; }
shift

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 $COMMAND <repo_path> [...]" >&2; exit 1; }

case "$COMMAND" in
  info)
    engine_dispatch "$REPO_PATH" github-issue-info "${SCRIPT_DIR}/github_issue_info_shell.sh" HOME -- "$@"
    ;;
  create)
    engine_dispatch "$REPO_PATH" github-issue-create "${SCRIPT_DIR}/github_issue_create_shell.sh" HOME -- "$@"
    ;;
  *)
    exec "${SCRIPT_DIR}/github_issue_shell.sh" "$COMMAND" "$@"
    ;;
esac
