# Add AutoFixAllReplyCommentValidation_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentValidation_spec.js` with a
top-level `describe('AutoFixAllReplyComment (argument validation)')` wrapping a nested
`describe('#run')`, and move the `describe('argument validation', ...)` block's 8 `it`s
(original spec's lines 121–199) into it verbatim — same assertions, same order:

1. throws the usage message when `repo_path` is missing
2. throws the usage message when `id` is missing
3. throws the usage message when `id` is non-numeric
4. throws the usage message when `id` is non-numeric even with a leading `#`
5. throws the usage message when `agent` is missing
6. throws the usage message when `model_name` is missing
7. throws the usage message when `model_email` is missing
8. throws the usage message when `reply_body` is missing

Keep the file's own `beforeEach`/`afterEach` (`repoPath = await createTempDir()` /
`await removeTempDir(repoPath)`), same as the original. Import `stubDeps`, `newContext`, and
the shared constants (`USAGE`, `ID`, `AGENT`, `MODEL_NAME`, `MODEL_EMAIL`, `REPLY_BODY`) from
`core/spec/support/factories/autoFixAllReplyComment.js` (step 01) instead of redeclaring them.
Update every `newContext()` call to `newContext(repoPath)` per step 01's signature change.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentValidation_spec.js` — new file;
  `describe('AutoFixAllReplyComment (argument validation)')` > `describe('#run')` with the 8
  argument-validation `it`s moved verbatim from the original spec.
