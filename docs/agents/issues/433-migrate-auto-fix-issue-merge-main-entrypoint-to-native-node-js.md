# Issue: Migrate auto-fix-issue-merge-main entrypoint to native Node.js

## Description
Sub-issue of #427 (batch overview) — part of the `auto-fix-issue` family of scripts being migrated to native Node.js.

Migrates `auto-fix-issue/scripts/merge_main.sh` to a native Node.js command, per the architecture in `docs/agents/architecture/script-engine.md`.

## Problem
`auto-fix-issue/scripts/merge_main.sh` (usage: `merge_main.sh <repo_path>`) still runs as a bash script rather than through the native command engine.

It merges `origin/main` into the currently checked-out issue branch:
- Assumes the target issue branch is already checked out.
- Fetches, then merges `origin/main` with `--no-edit`.
- A missing `origin/main` ref is a no-op success.
- Prints `STATUS=ok` or `STATUS=conflict` (with the conflicted-file list, one path per line, printed after the `STATUS` line on conflict).
- Exits 0 on `ok`, 2 on `conflict`.

External dependencies to re-derive natively:
- `git fetch`, `git merge --no-edit`, conflict detection — via `arcanum/_lib/git_branch.sh`'s `git_branch_merge_main` helper (not yet migrated): fetches main, checks whether `refs/remotes/origin/main` exists (returns 0 as a no-op if not), runs `git merge --no-edit origin/main`, and on failure does **not** abort the merge — it leaves the conflict markers in the working tree, prints each conflicted path (via `git diff --name-only --diff-filter=U`), and returns 2.

No in-batch script calls this one or is called by it — no dependencies on other sub-issues in the #427 batch.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/merge_main.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-fix-issue-merge-main': { module: 'commands/auto-fix-issue/AutoFixIssueMergeMain.js', method: 'run' }`.
4. Set `"auto-fix-issue-merge-main": true` in `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js`, including the exit-2 conflict path.
6. Write a parity test in `core/spec/bin/autoFixIssueMergeMainParity_spec.js` (shell vs. native, identical stdout and exit code, including the conflict case).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## Benefits
- Moves `auto-fix-issue-merge-main` off bash and onto the native engine, matching sibling migrations already completed in the #427 batch (e.g. `auto-fix-issue-create-branch`, `auto-fix-issue-list-plan-agents`).
- Native unit + parity tests (including the conflict path) give tighter coverage than the current shell script.
- One less bash entrypoint to maintain once the `auto-fix-issue` family is fully migrated.
