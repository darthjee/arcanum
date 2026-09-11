# Issue: Migrate auto-monitor-issue-pr-resolve-pr-number entrypoint to native Node.js

## Description

Part of the ongoing shell → Node.js entrypoint migration (see `docs/agents/architecture/script-engine.md`), tracked as batch overview #427. This issue migrates `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` to a native `core/lib/` module.

`resolve_pr_number.sh` resolves the PR number for an issue's branch. Usage: `resolve_pr_number.sh <repo_path> <id>`. `<id>` (numeric GitHub issue id, `#` prefix tolerated/stripped) is used only for validation and to read cached state — the actual lookup is driven by the current branch, which the caller is expected to have already checked out as `issue-<id>`.

It first checks the local issue state (`issue_state.sh get <id> pr_id`) to avoid a GitHub API call, returning that cached value if present. Otherwise it resolves the current branch's PR by shelling to `gh pr view -R <repo_ref> <branch> --json number` on the origin repo and prints the number (no `#`). It exits 1 with `Error: no pull request found for the current branch on <repo_ref>` if no PR is found for the branch, or if `gh pr view` fails outright.

This sub-issue has no dependency on any of the other scripts in the #427 batch — only on the already-migrated `issue-state` command.

## Expected Behavior

- Native `auto-monitor-issue-pr-resolve-pr-number <repo_path> <id>` produces byte-identical stdout and the same exit code as the shell script, for both the cache-hit and API-lookup paths, and for the not-found error path.
- With `engine.mode=native` in the target repo's config, the command dispatches to the native module; with `engine.mode=shell` or missing, it falls back to the existing shell script — verified via `arcanum/_lib/engine_dispatch.sh`.
- `<id>`'s `#` prefix is tolerated (stripped) the same way the shell script does, and a non-numeric `<id>` fails the same usage-error path.

## Solution

Follow the standard migration process from `docs/agents/architecture/script-engine.md`, the same shape as every other entrypoint in the #427 batch (e.g. #428, #434):

1. Rename `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` to `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh` (content unchanged), and replace it with a thin `engine_dispatch` shim — mirroring `auto-fix-issue/scripts/run_checks.sh`'s shape, forwarding `HOME` (needed for `gh` to resolve auth config once native's `env -i PATH="$PATH"` strips the ambient environment down).
2. Create `core/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js` — zero runtime npm deps, built-in Node APIs only for anything not already covered by existing native utilities (see below).
3. Register `'auto-monitor-issue-pr-resolve-pr-number': { module: 'commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js', method: 'run' }` in the `COMMANDS` map at `core/lib/core/commands.js`.
4. Add `"auto-monitor-issue-pr-resolve-pr-number": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber_spec.js`, covering both the cache-hit and API-lookup paths, plus the not-found error path.
6. Write a parity test against `resolve_pr_number_shell.sh` (the renamed shell implementation, never through the new shim) — shell vs. native, identical inputs, asserting identical stdout and exit code.
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

Do not shell out to `gh` or re-derive `origin.sh`'s `_ensure_gh_user`/`get_repo_ref` — this exact lookup is already covered natively:

- `core/lib/utils/github/GitHubClient.js`'s `getPr(branch)` already replaces `gh pr view -R <repo_ref> <branch> --json number` via the GitHub REST API (resolving `repo`/`repoRef`/token through the injected `RepoContext`), including the identical `Error: no pull request found for the current branch on <repoRef>` message on any failure. Use `getPr(branch).number` for the API-lookup path.
- `core/lib/utils/git/Git.js`'s `currentBranch()` (backed by `GitBranch`) already replaces `git branch --show-current`.
- `core/lib/services/IssueStateService.js`'s `get(id, field)` already replaces shelling to `core/bin/arcanum issue-state get <id> pr_id` for the cache-hit path — read the `pr_id` field directly in-process.

`core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js` already composes exactly this trio (`Git`, `GitHubClient`, `IssueStateService`, all bound to the same `repoContext` at construction) for a closely related PR-lookup flow — follow its constructor-injection pattern rather than inventing a new composition style.

## Benefits

- Moves `auto-monitor-issue-pr` one entrypoint closer to running fully on the native engine.
- Removes the last `gh` CLI dependency from this lookup path, replacing it with the already-migrated, REST-API-backed `GitHubClient`.
- Establishes parity test coverage protecting the cache-hit short-circuit and the exact not-found error message against regressions.
