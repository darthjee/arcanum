# Add AutoFixAllReplyCommentFailureModes_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentFailureModes_spec.js` with a
top-level `describe('AutoFixAllReplyComment (failure modes)')` wrapping a nested
`describe('#run')`, and move these three `describe` blocks (original spec's lines 243–295)
into it verbatim, in the same order:

1. `describe('when the REST call fails', ...)` — 2 `it`s: response `ok: false`, and `fetchFn`
   rejecting; both assert the error is thrown and `git push` is never attempted.
2. `describe('when resolve_pr_number.sh fails', ...)` — 1 `it`: asserts the error is thrown and
   `fetchFn` is never called.
3. `describe('when git push fails', ...)` — 1 `it`: asserts the error is thrown after the
   comment was already posted (`fetchFn` called once).

Keep the file's own `beforeEach`/`afterEach` temp-dir setup. Import `fakeExecFileAsync`,
`stubDeps`, `newContext`, and the shared constants from
`core/spec/support/factories/autoFixAllReplyComment.js` (step 01). Update every `newContext()`
call to `newContext(repoPath)`.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentFailureModes_spec.js` — new file;
  `describe('AutoFixAllReplyComment (failure modes)')` > `describe('#run')` with the 3
  failure-mode blocks (4 `it`s total) moved verbatim from the original spec.
