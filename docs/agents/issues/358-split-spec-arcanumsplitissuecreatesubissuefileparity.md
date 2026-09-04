# Issue: Split spec ArcanumSplitIssueCreateSubIssueFileParity

## Description

`core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` is 264 lines — a
shell-vs-native parity suite for the `arcanum-split-issue-create-sub-issue-file` migrated
entrypoint (issue #257), covering 8 top-level `describe` blocks: seven argument/file-existence
validation scenarios (missing `repo_path`, missing `issue_id`, missing `title`, missing
`body_file`, non-directory `repo_path`, non-git `repo_path`, a `body_file` that doesn't exist)
and one substantive scenario, "the success path". Shared local helpers (`runCommand`,
`runBoth`) and the `REPO_ROOT` / `SHELL_SCRIPT` / `NATIVE_BIN` constants precede the describes.

The entrypoint under test (`create_sub_issue_file_shell.sh`) is unchanged and out of scope —
this is spec-only reorganization, same shape as issues #347 and #354.

## Problem

Seven small, mechanically-similar validation scenarios and one substantive scenario (the
actual file-creation success path) sit in one file, making the success path easy to miss
among the validation boilerplate.

## Solution

Spec-only reorganization. No changes to `create_sub_issue_file_shell.sh` or the native
`arcanum-split-issue-create-sub-issue-file` implementation. No assertions change — every `it`
moves verbatim.

### Split into 2 files

New directory `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/`, following the
directly-analogous precedent `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/` (the
sibling `create_sub_issue` entrypoint, split under issue #354) and the earlier
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` convention (the original monolith is
deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `argument_validation_spec.js` | `a missing <repo_path> argument`, `a missing <issue_id> argument`, `a missing <title> argument`, `a missing <body_file> argument`, `a repo_path that is not a directory`, `a repo_path that is not a git repository`, `a body_file that does not exist` |
| `success_path_spec.js` | `the success path` |

Each new file carries an adapted version of the original file-header comment (the "#257
migrated entrypoint / output-exit-code contract / purely filesystem-based, no `gh`/network
dependency" note), with a one-line cross-reference to its sibling file describing which
scenarios live where — mirroring how `arcanumSplitIssueCreateSubIssueParity/`'s two files
cross-reference each other.

### Extract shared helpers

Move `runCommand` and `runBoth`, plus the `REPO_ROOT` / `SHELL_SCRIPT` / `NATIVE_BIN`
constants, into a shared support module
`core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js`, imported by
both new files. This matches the established naming convention from the sibling issues in this
series — `arcanumSplitIssueCreateSubIssueParitySetup.js`, `autoFixAllConfigParitySetup.js`,
`arcanumUpdateRunUpdateParitySetup.js` — which use the `...ParitySetup.js` suffix and export
their `SHELL_SCRIPT` / `NATIVE_BIN` constants alongside the run helpers. Behavior copied
verbatim.

### Done when

- `arcanumSplitIssueCreateSubIssueFileParity_spec.js` is gone; the two new files exist with
  every `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists at
  `core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js` and both
  specs import the helpers and constants from it (no copy-pasted helpers or constants).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean (including the new support module).

### Out of scope

- Any change to `create_sub_issue_file_shell.sh` or the native
  `arcanum-split-issue-create-sub-issue-file` implementation.

## Benefits

- The success-path scenario is no longer buried among seven validation blocks.
- Shared setup lives in one reusable place instead of being duplicated.
- Naming stays consistent with the rest of the parity-spec-split series (`...ParitySetup.js`).
- Pure navigability improvement — no behavior or coverage change, low review risk.
