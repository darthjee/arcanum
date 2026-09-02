# Issue: Split spec AutoFixAllReplyCommentParity

## Description

`core/spec/bin/autoFixAllReplyCommentParity_spec.js` is 275 lines — a shell-vs-native parity
suite for the `auto-fix-all-reply-comment` migrated entrypoint, covering 6 top-level
`describe` blocks: three argument/repo-path validation scenarios, "no pull request found for
the current branch", "the REST call to post the comment fails", and "the happy path". Shared
local helpers (`runCommand`, `git`, `seedGithubLikeRepo`) precede the describes.

The entrypoint under test (`reply_comment_shell.sh`) is unchanged and out of scope — this is
spec-only reorganization, same shape as issue #347.

## Problem

One large file mixes unrelated concerns (precondition/validation failures vs. the two
substantive network-touching scenarios — REST failure and the happy path — that this
entrypoint uniquely exercises, unlike most sibling parity specs which skip the happy path
entirely).

## Solution

Spec-only reorganization. No changes to `reply_comment_shell.sh` or the native
`auto-fix-all-reply-comment` implementation. No assertions change — every `it` moves verbatim.

### Split into 3 files

New directory `core/spec/bin/autoFixAllReplyCommentParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `preconditions_spec.js` | `a missing required argument`, `a present-but-non-directory repo_path (hard failure)`, `a non-git repo_path (hard failure)`, `no pull request found for the current branch` |
| `rest_failure_spec.js` | `the REST call to post the comment fails` |
| `happy_path_spec.js` | `the happy path` |

### Extract shared helpers

Move `runCommand`, `git`, and `seedGithubLikeRepo` into a shared support module (e.g.
`core/spec/support/factories/autoFixAllReplyCommentParity.js`), imported by all three new
files. Behavior copied verbatim.

### Done when

- `autoFixAllReplyCommentParity_spec.js` is gone; the three new files exist with every `it`
  from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and all three specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `reply_comment_shell.sh` or the native `auto-fix-all-reply-comment`
  implementation.

## Benefits

- The two substantive network-touching scenarios (REST failure, happy path) are no longer
  buried among precondition checks.
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
