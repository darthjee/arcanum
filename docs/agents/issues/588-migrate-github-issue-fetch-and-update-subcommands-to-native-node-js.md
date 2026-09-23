# Issue: Migrate github-issue fetch and update subcommands to native Node.js

## Description

Sub-issue A of #584. Migrate the `fetch` and `update` subcommands of `arcanum/_lib/github_issue.sh` to native Node.js, following the #237 per-subcommand pattern used for `info`/`create`.

## Problem

`fetch` and `update` reach `github_issue_shell.sh` through the `*)` `exec` fallthrough in `github_issue.sh`, so they never go through `engine_dispatch`.

- **`fetch`**: `GithubIssue#fetch(repoPath, id)` (`core/lib/commands/shared/GithubIssue.js`) already exists and has specs (`GithubIssueFetch_spec.js`), but only native `resolve-and-fetch` uses it, as a collaborator. It has no command-line entrypoint, does not produce `cmd_fetch`'s stdout, and does not do the `repo_path_enter` validation.
- **`update`**: nothing native. `IssueClient` has no PATCH/update method.

## Expected Behavior

Both subcommands route through `engine_dispatch`. In both `engine.mode=native` and `engine.mode=shell`, stdout, stderr and exit codes must match today's shell exactly:

- `fetch <repo_path> <id>`: validates `repo_path` like `repo_path_enter`, prints `TITLE=`/`FILE=`/`DOMAIN=`/`REPO=` lines, writes `docs/agents/issues/<id>-<slug>.md` inside the repo, and persists `.claude/state/issue-<id>.json` (tags, updated_at, title, state). On failure prints `Error: could not fetch issue #<id> from <repo>` and exits 1.
- `update <repo_path> <id> <title> <file>`: PATCHes the title and body (the body is the file contents with trailing newlines trimmed, matching `$(cat)`), then prints `Updated issue #<id> on <repo>`. Exits 1 when the file is missing (`Error: file not found: <file>`) or the request fails (`Error: could not update issue #<id> on <repo>`).
  - `cmd_update` does **not** call `repo_path_enter`. It only runs `_load_origin`, and it never `cd`s, so `<file>` is resolved relative to the caller's cwd. Native `update` must keep both behaviors.

## Solution

Follow `docs/agents/architecture/script-engine.md`:

1. Add thin wrappers `arcanum/_lib/github_issue_fetch_shell.sh` and `github_issue_update_shell.sh`, which `exec` `github_issue_shell.sh fetch|update "$@"`. This is the same pattern as the existing `github_issue_create_shell.sh`, not a copy of `cmd_fetch`/`cmd_update`. Leave `github_issue_shell.sh` as it is; removing it is a separate, later cleanup.
2. Add `fetch)` and `update)` `case` branches to `github_issue.sh`. Each branch first checks its full argument count: `<id>` for `fetch`; `<id> <title> <file>` for `update`. On failure it prints a single usage error (`Usage: $0 fetch <repo_path> <id>` / `Usage: $0 update <repo_path> <id> <title> <file>`) and exits 1. Only then does it call `engine_dispatch "$REPO_PATH" github-issue-<cmd> "<shell impl>" HOME -- "$@"`. Usage errors therefore live in the central shim and are identical in both modes, and the native side can assume its arguments are present. Keep the `*)` fallthrough for now, because the `mark-*` subcommands still use it until #589 lands. Update the header comment so it says only `mark-*` still bypass `engine_dispatch`.
3. **Native `fetch`**: add a command-line path on `GithubIssue` that uses the same `repoContext`-aware argument shift as `info`/`create`. It reuses the existing `fetch` logic, formats the `KEY=value` output, and relies on `RepoContext#validate()` for the `repo_path_enter` check (default registry validation).
4. **Native `update`**: add `IssueClient#updateIssue(id, { title, body })` (PATCH, error `Error: could not update issue #<id> on <repo>`) and a `GithubIssue#update` that mirrors `cmd_update`. Register it with `validateRepoPath: false`, like `github-issue-info`, and read `<file>` relative to the process cwd, not `repoPath`.
5. Register `github-issue-fetch` and `github-issue-update` in the native command registry (`core/lib/core/commands.js`). Add `true` keys for both to `arcanum/_lib/migration-status.json`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` with `scripts/generate_entrypoint_migration_status.sh`. Leave the umbrella `"github-issue": false` key alone; #589 removes it.
6. Add native unit specs that mirror `core/lib/` one-to-one, plus `githubIssueFetchParity_spec.js` and `githubIssueUpdateParity_spec.js` under `core/spec/bin/`. Verify `engine_dispatch.sh` routing for both modes.

## Benefits

- The two most-used `github-issue` subcommands (called by every `discuss-issue` / `auto-new-issue` run) follow `engine.mode`.
- Reuses the already-tested native `fetch` logic instead of leaving it half-wired.
