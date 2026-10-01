# Node Plan: discuss-issue → auto-fix-issue chain fails: issue/plan only on issue-<id> branch after release to origin/main

Main plan: [plan.md](plan.md)

## Shared contracts

- Remove the native half of entrypoints `auto-fix-issue-create-branch` and `auto-fix-issue-merge-main`. Scripter removes the shell scripts and `migration-status.json` keys in the same PR.
- `auto-fix-all-checkout-from-main` (`AutoFixAllCheckoutFromMain.js`) stays unchanged.

## Implementation Steps

### Step 1 — Remove the native commands and registry entries
Delete `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js` and `AutoFixIssueMergeMain.js`. Remove their entries from `core/lib/core/commands.js` (registry objects around lines 226 and 259, plus the header comment around line 22). If any shared helper becomes unused only because of this removal, delete it too. Leave helpers that `AutoFixAllCheckoutFromMain.js` still uses.

### Step 2 — Remove the specs
Delete `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js`, `AutoFixIssueMergeMain_spec.js`, `core/spec/bin/autoFixIssueCreateBranchParity_spec.js` and `autoFixIssueMergeMainParity_spec.js`. Drop both names from the expected-command list in `core/spec/lib/core/commands_spec.js`.

## Files to Change
- `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js`, `AutoFixIssueMergeMain.js` — deleted.
- `core/lib/core/commands.js` — drop two registry entries and the comment mention.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js`, `AutoFixIssueMergeMain_spec.js` — deleted.
- `core/spec/bin/autoFixIssueCreateBranchParity_spec.js`, `autoFixIssueMergeMainParity_spec.js` — deleted.
- `core/spec/lib/core/commands_spec.js` — drop the two names.

## CI Checks
Before opening a PR, run the following checks:
- `core`: `yarn test` (CircleCI job: `test`)
- `core`: `yarn lint` (CircleCI job: `checks`)
