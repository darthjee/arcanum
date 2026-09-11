# scripter Plan: Migrate auto-fix-issue-github entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces `auto-fix-issue/scripts/github_shell.sh` (the renamed, content-unchanged shell implementation) at the exact path node's parity tests will invoke directly.
- Produces the new `auto-fix-issue/scripts/github.sh` as a per-subcommand router: it parses `$1` itself, maps it to one of the four command names below, and calls `engine_dispatch` with that command name and `github_shell.sh` as the fallback, forwarding the **full original argument list** (subcommand included) through unchanged.
- The four command names — `auto-fix-issue-github-info`, `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-view`, `auto-fix-issue-github-pr-ready` — must match node's `COMMANDS` map keys and the `migration-status.json` keys exactly.
- `HOME` is forwarded in the env allowlist for `pr-create`/`pr-view`/`pr-ready` only, not `info`.

## Implementation Steps

### Step 1 — Split the script into a shell implementation and a per-subcommand engine_dispatch router

Rename `auto-fix-issue/scripts/github.sh` to `auto-fix-issue/scripts/github_shell.sh`, content unchanged (same `cmd_info`/`cmd_pr_create`/`cmd_pr_view`/`cmd_pr_ready` functions, same shared `_current_issue_id`/`_persist_pr_state`/`_sync_pr_labels_and_state` helpers, same `case "${1:-}" in info|pr-create|pr-view|pr-ready) repo_path_enter "${2:-}" ;; esac` guard and final dispatch case-statement, same `export GH_INSECURE_SKIP_VERIFY=true` at the top).

Create a new `auto-fix-issue/scripts/github.sh` as a thin per-subcommand `engine_dispatch` router — unlike `commit_change.sh`/`create_branch.sh`'s shims (which each wrap a single command), this one must pick the right command name based on `$1` before dispatching, since `github.sh` bundles four subcommands:

```bash
#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch router for the
# "auto-fix-issue-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Unlike a single-command shim
# (commit_change.sh, create_branch.sh), this script bundles four
# subcommands (info, pr-create, pr-view, pr-ready), so it must resolve
# the right migration-status.json/COMMANDS key from $1 before calling
# engine_dispatch, once per invocation — never for the whole script.
#
# HOME is forwarded to the native path's explicit env-var allowlist for
# pr-create/pr-view/pr-ready only (all three resolve a GitHub token via
# `gh`, which needs HOME to find its own auth config once native's
# `env -i PATH="$PATH"` strips the ambient environment down); info needs
# no env vars (git-only, no gh call), mirroring create_branch.sh's
# no-env-var precedent for a git-only entrypoint.
#
# Usage: github.sh <command> <repo_path> [args]
#   info <repo_path>                        Print DOMAIN and REPO from git origin
#   pr-create <repo_path> <title> <file>    Create a pull request with title and body from a file
#   pr-view <repo_path>                     Print URL and IS_DRAFT for the current branch's PR
#   pr-ready <repo_path>                    Mark the current branch's PR as ready for review
#
# Output and exit code: unchanged from before this migration — see
# github_shell.sh's own header for the full per-subcommand contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

SUBCOMMAND="${1:-}"
REPO_PATH="${2:-}"

case "$SUBCOMMAND" in
  info)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-info "${SCRIPT_DIR}/github_shell.sh" -- "$@"
    ;;
  pr-create)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-create "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  pr-view)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-view "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  pr-ready)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-ready "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  *)
    exec bash "${SCRIPT_DIR}/github_shell.sh" "$@"
    ;;
esac
```

The `*)` fallback (unknown/missing subcommand) delegates straight to `github_shell.sh`, which already owns the usage-message/exit-1 contract for that case — no need to duplicate it here. Note `engine_dispatch` re-passes `"$@"` (the full original arg list, subcommand included) to `github_shell.sh` on the shell-fallback path, exactly matching today's invocation shape.

### Step 2 — Mark the four entrypoints migrated

Add four keys to `arcanum/_lib/migration-status.json`, keeping the file's existing key ordering/formatting conventions:

```json
"auto-fix-issue-github-info": true,
"auto-fix-issue-github-pr-create": true,
"auto-fix-issue-github-pr-view": true,
"auto-fix-issue-github-pr-ready": true,
```

(Replacing the single `"auto-fix-issue-github": false` entry already present, if the file still has it from an earlier scaffold — confirm current state before editing.)

## Files to Change

- `auto-fix-issue/scripts/github.sh` — replace with the per-subcommand `engine_dispatch` router.
- `auto-fix-issue/scripts/github_shell.sh` — new file, the renamed original shell implementation (unchanged content).
- `arcanum/_lib/migration-status.json` — add the four `auto-fix-issue-github-*` keys, `true`.

## Notes

- No caller of `auto-fix-issue/scripts/github.sh` needs updating — the router keeps the same filename and argument contract, so every existing invocation (from `auto-fix-issue`'s own markdown steps) is unaffected.
- Do not touch `arcanum/_lib/tags.sh`, `arcanum/_lib/tag_mutate.sh`, `arcanum/_lib/origin.sh`, or `arcanum/_lib/repo_path.sh` — per `docs/agents/architecture/script-engine.md`'s "no standalone, wholesale `_lib` migration" rule, node reuses its own already-grown native equivalents of these (see node's plan) rather than this issue migrating the shell helpers wholesale.
- Land this after (or together with, in the same PR) node's work — the router's native path only activates once both the `COMMANDS` entries and the `migration-status.json` flips exist; until then `engine_dispatch` safely warns and falls back to `github_shell.sh` for every subcommand.
