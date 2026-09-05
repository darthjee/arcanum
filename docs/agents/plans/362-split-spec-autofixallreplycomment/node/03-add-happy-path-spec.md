# Add AutoFixAllReplyCommentHappyPath_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentHappyPath_spec.js` with a
top-level `describe('AutoFixAllReplyComment (happy path)')` wrapping a nested
`describe('#run')`, and move the `describe('the happy path', ...)` block's single `it`
(original spec's lines 203–240 — "resolves the PR number, posts the rendered comment, pushes
the branch, and resolves with the push stdout") into it verbatim, including its comment about
exercising the first-occurrence-only `%%AGENT%%` substitution rule and all its assertions
(`readFile` called with `TEMPLATE_PATH`, the `resolve_pr_number.sh` call, the rendered
`fetchFn` POST body, the `git branch --show-current` and `git push` calls).

Keep the file's own `beforeEach`/`afterEach` temp-dir setup. Import `fakeReadFile`, `stubDeps`,
`newContext`, and the shared constants from
`core/spec/support/factories/autoFixAllReplyComment.js` (step 01). Update the `newContext()`
call to `newContext(repoPath)`.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentHappyPath_spec.js` — new file;
  `describe('AutoFixAllReplyComment (happy path)')` > `describe('#run')` with the happy-path
  `it` moved verbatim from the original spec.
