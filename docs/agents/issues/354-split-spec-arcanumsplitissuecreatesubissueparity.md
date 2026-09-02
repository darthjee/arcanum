# Issue: Split spec ArcanumSplitIssueCreateSubIssueParity

## Description

`core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` is 285 lines — a shell-vs-native
parity suite for the `arcanum-split-issue-create-sub-issue` migrated entrypoint, covering 7
top-level `describe` blocks: six argument/file-existence validation scenarios (missing
`repo_path`, missing `issue_id`, missing `sub_issue_file`, non-directory `repo_path`, non-git
`repo_path`, a `sub_issue_file` that doesn't exist) and one substantive behavioral scenario
(the retry-exhausted failure path with `plan-issues.max-retry-count: 0`). Shared local helpers
(`runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo`) precede the describes.

The entrypoint under test (`create_sub_issue_shell.sh`) is unchanged and out of scope — this
is spec-only reorganization, same shape as issue #347.

## Problem

Six small, mechanically-similar validation scenarios and one substantive behavioral scenario
sit in one file, making the one interesting scenario (retry exhaustion) easy to miss among the
validation boilerplate.

## Solution

Spec-only reorganization. No changes to `create_sub_issue_shell.sh` or the native
`arcanum-split-issue-create-sub-issue` implementation. No assertions change — every `it`
moves verbatim.

### Split into 2 files

New directory `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `argument_validation_spec.js` | `a missing <repo_path> argument`, `a missing <issue_id> argument`, `a missing <sub_issue_file> argument`, `a repo_path that is not a directory`, `a repo_path that is not a git repository`, `a sub_issue_file that does not exist` |
| `retry_exhausted_spec.js` | `the retry-exhausted failure path (plan-issues.max-retry-count: 0)` |

### Extract shared helpers

Move `runCommand`, `runBoth`, `writeSubIssueFile`, and `seedZeroRetryRepo` into a shared
support module (e.g. `core/spec/support/factories/arcanumSplitIssueCreateSubIssueParity.js`),
imported by both new files (`argument_validation_spec.js` only needs `runCommand`/`runBoth`;
`retry_exhausted_spec.js` needs all four). Behavior copied verbatim.

### Done when

- `arcanumSplitIssueCreateSubIssueParity_spec.js` is gone; the two new files exist with every
  `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `create_sub_issue_shell.sh` or the native
  `arcanum-split-issue-create-sub-issue` implementation.

## Benefits

- The retry-exhaustion scenario is no longer buried among six validation blocks.
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
