# Issue: Migrate auto-fix-issue-create-branch entrypoint to native Node.js

## Description
Sub-issue of #427 (batch overview) — part of the `auto-fix-issue` family of scripts being migrated to native Node.js.

Migrates `auto-fix-issue/scripts/create_branch.sh` to a native Node.js command, per the architecture in `docs/agents/architecture/script-engine.md`.

## Problem
`auto-fix-issue/scripts/create_branch.sh` (usage: `create_branch.sh <repo_path> <plan_dir> <id>`) still runs as a bash script rather than through the native command engine.

It creates or checks out the branch defined in an implementation plan:
- Reads `<plan_dir>/plan.md` and looks for a `## Branch` section to determine the branch name (the line right after the heading, backticks/whitespace stripped).
- Falls back to `issue-<id>` if the plan file doesn't exist, has no `## Branch` section, or the extracted name is empty.
- Checks out the branch if it already exists locally, otherwise creates it.
- Prints the resulting branch name to stdout (single line).
- `<plan_dir>` is resolved relative to `<repo_path>` after entering it (or absolute).

External dependencies to re-derive natively:
- `git show-ref --verify --quiet refs/heads/<branch>` and `git checkout [-b] <branch>` (no GitHub API calls).
- Plan-file parsing is plain text (`grep -A2 '^## Branch' | tail -1 | tr -d`) — must be re-derived natively without shelling out to `grep`/`tr`.

No in-batch script calls this one or is called by it — no dependencies on other sub-issues in the #427 batch.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/create_branch.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-fix-issue-create-branch': { module: 'commands/auto-fix-issue/AutoFixIssueCreateBranch.js', method: 'run' }`.
4. Set `"auto-fix-issue-create-branch": true` in `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for both `engine.mode=native` and `engine.mode=shell`.

## Benefits
- Moves `auto-fix-issue-create-branch` off bash and onto the native engine, matching sibling migrations already completed in the #427 batch (e.g. `auto-fix-issue-commit-change`).
- Native unit + parity tests give tighter coverage than the current shell script.
- One less bash entrypoint to maintain once the `auto-fix-issue` family is fully migrated.
