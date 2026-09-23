#!/usr/bin/env bash
# Thin per-sub-command engine_dispatch shim for the "github-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md,
# docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/plan.md
# (#237, `info`/`create`) and
# docs/agents/plans/588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js/plan.md
# (#588, `fetch`/`update`) for the full design/shared contracts.
# `info`/`create`/`fetch`/`update` route through engine_dispatch; only
# `mark-*` still call the shell implementation directly, unchanged, until
# #589 migrates them. `fetch`/`update` check their positional arguments
# here, before dispatching, so neither engine needs usage-error handling.
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
  fetch)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 fetch <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-fetch "${SCRIPT_DIR}/github_issue_fetch_shell.sh" HOME -- "$@"
    ;;
  update)
    [[ -n "${2:-}" && -n "${3:-}" && -n "${4:-}" ]] \
      || { echo "Usage: $0 update <repo_path> <id> <title> <file>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-update "${SCRIPT_DIR}/github_issue_update_shell.sh" HOME -- "$@"
    ;;
  *)
    exec "${SCRIPT_DIR}/github_issue_shell.sh" "$COMMAND" "$@"
    ;;
esac
