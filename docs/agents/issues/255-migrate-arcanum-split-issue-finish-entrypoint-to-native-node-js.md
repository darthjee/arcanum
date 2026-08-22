# Issue: Migrate arcanum-split-issue-finish entrypoint to native Node.js

## Description
Sub-issue of #252 (batch overview), part of the `arcanum-split-issue` family. Migrate `arcanum-split-issue/scripts/finish.sh` to native Node.js, following the pattern established in `docs/agents/architecture/script-engine.md`.

`finish.sh` runs after all sub-issues of a split have been pushed: it relabels the parent issue (`Planning` -> `Split`), deletes local working files (`docs/agents/issues/<id>-*` and `<id>_*`), and releases the working tree to the configured safe branch.

## Solution
1. Read `arcanum-split-issue/scripts/finish.sh` for its exact output/exit-code contract.
2. Create `core/lib/ArcanumSplitIssueFinish.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'arcanum-split-issue-finish': { module: 'ArcanumSplitIssueFinish.js', method: 'run' }`.
4. Add `"arcanum-split-issue-finish": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/ArcanumSplitIssueFinish_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

### External dependencies
- Calls `arcanum-split-issue/scripts/github.sh mark-split` — an **out-of-batch** thin wrapper delegating to `arcanum/_lib/github_issue.sh` (tracked separately as `github-issue`, currently only partially migrated via `github-issue-create`/`github-issue-info`). `mark-split` itself is not yet natively migrated, so the new module should shell out to it as-is for now.
- Calls `safe_branch_checkout` from `arcanum/_lib/safe_branch.sh` — **already migrated** as `core/lib/SafeBranch.js` (`checkout-safe-branch` command, `true` in `migration-status.json`). Reuse the native `SafeBranch` class directly rather than shelling out.
- Local filesystem cleanup only otherwise — no other GitHub API calls.

### Dependencies on other sub-issues
None — no in-batch script calls this one, and it calls no other in-batch script.
