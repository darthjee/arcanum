#!/usr/bin/env bash
# Thin per-sub-command engine_dispatch shim for the "github-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md,
# docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/plan.md
# (#237, `info`/`create`),
# docs/agents/plans/588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js/plan.md
# (#588, `fetch`/`update`) and
# docs/agents/plans/589-migrate-github-issue-mark-subcommands-to-native-node-js-and-finish-the-entrypoint-migration/plan.md
# (#589, `mark-*`) for the full design/shared contracts.
# All ten subcommands route through engine_dispatch. `fetch`/`update`/`mark-*`
# check their positional arguments here, before dispatching, so neither
# engine needs usage-error handling. Unknown subcommands get the usage
# error below (exit 1).
#
# Usage: github_issue.sh <command> [args]
# Commands:
#   info <repo_path>                            Print DOMAIN and REPO from git origin
#   fetch <repo_path> <id>                      Fetch a GitHub issue and save to docs/agents/issues/
#   update <repo_path> <id> <title> <file>      Update a GitHub issue title and body from a file
#   create <repo_path> <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/
#   mark-created <repo_path> <id>               Add the Created label and remove Idea/Writting/Enhancing, if present
#   mark-refined <repo_path> <id>               Add the Refined label and remove Created/Idea/Writting, if present
#   mark-ready <repo_path> <id>                 Add the Ready label and remove Refined, if present
#   mark-enhancing <repo_path> <id>             Add the Enhancing label and remove Idea/Writting, if present
#   mark-planning <repo_path> <id>              Add the Planning label and remove Idea/Writting/Created, if present
#   mark-split <repo_path> <id>                 Add the Split label and remove Planning, if present

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
  mark-created)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-created <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-created "${SCRIPT_DIR}/github_issue_mark_created_shell.sh" HOME -- "$@"
    ;;
  mark-refined)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-refined <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-refined "${SCRIPT_DIR}/github_issue_mark_refined_shell.sh" HOME -- "$@"
    ;;
  mark-ready)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-ready <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-ready "${SCRIPT_DIR}/github_issue_mark_ready_shell.sh" HOME -- "$@"
    ;;
  mark-enhancing)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-enhancing <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-enhancing "${SCRIPT_DIR}/github_issue_mark_enhancing_shell.sh" HOME -- "$@"
    ;;
  mark-planning)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-planning <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-planning "${SCRIPT_DIR}/github_issue_mark_planning_shell.sh" HOME -- "$@"
    ;;
  mark-split)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-split <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-split "${SCRIPT_DIR}/github_issue_mark_split_shell.sh" HOME -- "$@"
    ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info <repo_path>                            Print DOMAIN and REPO from git origin" >&2
    echo "  fetch <repo_path> <id>                      Fetch a GitHub issue and save to docs/agents/issues/" >&2
    echo "  update <repo_path> <id> <title> <file>      Update a GitHub issue title and body from a file" >&2
    echo "  create <repo_path> <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/" >&2
    echo "  mark-created <repo_path> <id>               Add the Created label and remove Idea/Writting/Enhancing, if present" >&2
    echo "  mark-refined <repo_path> <id>               Add the Refined label and remove Created/Idea/Writting, if present" >&2
    echo "  mark-ready <repo_path> <id>                 Add the Ready label and remove Refined, if present" >&2
    echo "  mark-enhancing <repo_path> <id>             Add the Enhancing label and remove Idea/Writting, if present" >&2
    echo "  mark-planning <repo_path> <id>              Add the Planning label and remove Idea/Writting/Created, if present" >&2
    echo "  mark-split <repo_path> <id>                 Add the Split label and remove Planning, if present" >&2
    exit 1
    ;;
esac
