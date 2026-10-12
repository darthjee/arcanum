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
# Under engine.mode=docker all ten subcommands run core/bin/arcanum
# inside the container, now that their migration-status.json status is
# `"docker"` (#747), with the repo mount plus
# `--needs=global-config,gitconfig,gh`: the global arcanum config
# ($CLAUDE_CONFIG_DIR/arcanum-config.json) and the global git config are
# mounted read-only, and a GitHub token resolved on the host is
# forwarded by name only as `-e GH_TOKEN` (`-e GH_HOST`/`-e
# GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never as a value in
# argv. `create` adds `--path-arg=3:ro` and `update` adds
# `--path-arg=4:ro`, mounting <file> read-only at its own host path when
# it sits outside the repo. HOME stays in the allowlist for the native
# path. If docker is unavailable, engine_dispatch falls back to native
# on the host with a warning — see docs/agents/specs/docker/dispatch.md
# and docs/agents/specs/docker/environment.md.
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
#   mark-split <repo_path> <id>                 Add the Split and Epic labels and remove Planning, if present

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
    engine_dispatch "$REPO_PATH" github-issue-info "${SCRIPT_DIR}/github_issue_info_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  create)
    engine_dispatch "$REPO_PATH" github-issue-create "${SCRIPT_DIR}/github_issue_create_shell.sh" --needs=global-config,gitconfig,gh --path-arg=3:ro HOME -- "$@"
    ;;
  fetch)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 fetch <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-fetch "${SCRIPT_DIR}/github_issue_fetch_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  update)
    [[ -n "${2:-}" && -n "${3:-}" && -n "${4:-}" ]] \
      || { echo "Usage: $0 update <repo_path> <id> <title> <file>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-update "${SCRIPT_DIR}/github_issue_update_shell.sh" --needs=global-config,gitconfig,gh --path-arg=4:ro HOME -- "$@"
    ;;
  mark-created)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-created <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-created "${SCRIPT_DIR}/github_issue_mark_created_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  mark-refined)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-refined <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-refined "${SCRIPT_DIR}/github_issue_mark_refined_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  mark-ready)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-ready <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-ready "${SCRIPT_DIR}/github_issue_mark_ready_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  mark-enhancing)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-enhancing <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-enhancing "${SCRIPT_DIR}/github_issue_mark_enhancing_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  mark-planning)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-planning <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-planning "${SCRIPT_DIR}/github_issue_mark_planning_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  mark-split)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-split <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-split "${SCRIPT_DIR}/github_issue_mark_split_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
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
    echo "  mark-split <repo_path> <id>                 Add the Split and Epic labels and remove Planning, if present" >&2
    exit 1
    ;;
esac
