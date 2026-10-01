# Plan: discuss-issue → auto-fix-issue chain fails: issue/plan only on issue-<id> branch after release to origin/main

Issue: [694-discuss-issue-auto-fix-issue-chain-fails-issue-plan-only-on-issue-id-branch-after-release-to-origin-main.md](../../issues/694-discuss-issue-auto-fix-issue-chain-fails-issue-plan-only-on-issue-id-branch-after-release-to-origin-main.md)

## Overview
Make `auto-fix-issue` bootstrap its own branch before it looks for the issue and plan. Its new Step 1 calls `auto-fix-all/scripts/checkout_from_main.sh`, which `auto-fix-all` already uses. Locating the issue and plan moves to Step 2. The old branch step (`create_branch.sh` + `merge_main.sh`) goes away, and with it the unused `## Branch` override. The two scripts, their native counterparts, specs and migration-status entries are deleted, since `auto-fix-issue/steps/run.md` is their only caller.

## Agents involved

- [skill-writer](skill-writer.md)
- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Branch bootstrap call** (consumed by skill-writer, unchanged script): `../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>`, resolved relative to the `auto-fix-issue` skill folder. It prints `BRANCH=issue-<id>`, then `STATUS=ok` or `STATUS=conflict` followed by one conflicted path per line. It exits non-zero on hard failure, such as a dirty tracked-file working tree.
- **Removed entrypoints** (scripter and node delete their halves together, so `engine_dispatch` never points at a missing module):
  - `auto-fix-issue-create-branch`: `auto-fix-issue/scripts/create_branch.sh`, `create_branch_shell.sh` ↔ `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js`
  - `auto-fix-issue-merge-main`: `auto-fix-issue/scripts/merge_main.sh`, `merge_main_shell.sh` ↔ `core/lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js`
- **Resume state values**: `branch_created` (new Step 1 done) and `plan_located` (new Step 2 done) keep their names. A recorded `branch_created` or `plan_located` resumes from Step 3. Step 1 (bootstrap) always re-runs on resume (except for `pr_published`), because it is idempotent and an old-order state file may record `plan_located` without a checked-out branch.
