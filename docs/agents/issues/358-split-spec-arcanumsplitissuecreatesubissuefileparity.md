# Issue: Split spec ArcanumSplitIssueCreateSubIssueFileParity

## Description

`core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` is 264 lines — a
shell-vs-native parity suite for the `arcanum-split-issue-create-sub-issue-file` migrated
entrypoint, covering 8 top-level `describe` blocks: seven argument/file-existence validation
scenarios (missing `repo_path`, missing `issue_id`, missing `title`, missing `body_file`,
non-directory `repo_path`, non-git `repo_path`, a `body_file` that doesn't exist) and one
substantive scenario, "the success path". Shared local helpers (`runCommand`, `runBoth`)
precede the describes.

The entrypoint under test (`create_sub_issue_file_shell.sh`) is unchanged and out of scope —
this is spec-only reorganization, same shape as issue #347.

## Problem

Seven small, mechanically-similar validation scenarios and one substantive scenario (the
actual file-creation success path) sit in one file, making the success path easy to miss
among the validation boilerplate.

## Solution

Spec-only reorganization. No changes to `create_sub_issue_file_shell.sh` or the native
`arcanum-split-issue-create-sub-issue-file` implementation. No assertions change — every `it`
moves verbatim.

### Split into 2 files

New directory `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/`, mirroring the
existing `autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original
monolith is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `argument_validation_spec.js` | `a missing <repo_path> argument`, `a missing <issue_id> argument`, `a missing <title> argument`, `a missing <body_file> argument`, `a repo_path that is not a directory`, `a repo_path that is not a git repository`, `a body_file that does not exist` |
| `success_path_spec.js` | `the success path` |

### Extract shared helpers

Move `runCommand` and `runBoth` into a shared support module (e.g.
`core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParity.js`), imported by both
new files. Behavior copied verbatim.

### Done when

- `arcanumSplitIssueCreateSubIssueFileParity_spec.js` is gone; the two new files exist with
  every `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `create_sub_issue_file_shell.sh` or the native
  `arcanum-split-issue-create-sub-issue-file` implementation.

## Benefits

- The success-path scenario is no longer buried among seven validation blocks.
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
