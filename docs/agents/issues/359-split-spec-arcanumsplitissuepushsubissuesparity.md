# Issue: Split spec ArcanumSplitIssuePushSubIssuesParity

## Description

`core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js` is 260 lines — a shell-vs-native
parity suite for the `arcanum-split-issue-push-sub-issues` migrated entrypoint, covering 4
top-level `describe` blocks: "zero matching files", the "stops at first failure" contract
(`plan-issues.max-retry-count: 0`), and two repo-path validation scenarios (non-directory,
non-git). Shared local helpers (`runCommand`, `runBoth`, `writeSubIssueFile`,
`seedZeroRetryRepo`) precede the describes.

The entrypoint under test (`push_sub_issues_shell.sh`) is unchanged and out of scope — this is
spec-only reorganization, same shape as issue #347.

## Problem

Two small validation scenarios and two substantive behavioral scenarios sit in one file. The
file is smaller than most others in this batch, but still mixes two unrelated concerns
(repo-path preconditions vs. actual push-loop behavior).

## Solution

Spec-only reorganization. No changes to `push_sub_issues_shell.sh` or the native
`arcanum-split-issue-push-sub-issues` implementation. No assertions change — every `it` moves
verbatim.

### Split into 2 files

New directory `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `argument_validation_spec.js` | `a present-but-non-directory repo_path (hard failure)`, `a non-git repo_path (hard failure)` |
| `push_behavior_spec.js` | `zero matching files`, `the "stops at first failure" contract (plan-issues.max-retry-count: 0)` |

### Extract shared helpers

Move `runCommand`, `runBoth`, `writeSubIssueFile`, and `seedZeroRetryRepo` into a shared
support module (e.g. `core/spec/support/factories/arcanumSplitIssuePushSubIssuesParity.js`),
imported by both new files (`argument_validation_spec.js` only needs
`runCommand`/`runBoth`; `push_behavior_spec.js` needs all four). Behavior copied verbatim.

### Done when

- `arcanumSplitIssuePushSubIssuesParity_spec.js` is gone; the two new files exist with every
  `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `push_sub_issues_shell.sh` or the native
  `arcanum-split-issue-push-sub-issues` implementation.

## Benefits

- Precondition checks and actual push-loop behavior become independently readable.
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
