# Migrate the git fakes
Move the three `git` dispatcher fakes onto `fakeExecFileAsync('git', [...routes])`. Keep names, option signatures and behaviour:

- **commitCommandFixtures.js `fakeGitExecFileAsync`**:
  - Keep the `let staged = false` closure state.
  - Routes, in the current order: `ls-files`/`rm`/`diff` (only when `tracked`); `add` (only when `!tracked && stagesAdd`); then `commit`, `branch` and `push`.
  - The `commit` route must return `{ stdout: '', __input: options.input }`, using the helper's `options` argument.
  - `diff` must still throw an error with `code = 1` once something has been staged.
- **AutoFixIssueCreateBranch_spec.js**:
  - `show-ref` resolves, or throws `code = 1` "not found"
  - `checkout` resolves
- **AutoFixIssueMergeMain_spec.js**:
  - `fetch` throws `fetchError` when it is set
  - `show-ref` behaves as in CreateBranch
  - `merge` throws "merge conflict" with `error.stdout = mergeStdout`
  - `diff` returns `diffStdout`

Conditional routes, like the `tracked`-gated ones, can be written either as a `match` predicate that includes the flag or by building the route array conditionally. Pick whichever reads more clearly.

## Files to Change
- `core/spec/support/factories/commitCommandFixtures.js` — `fakeGitExecFileAsync` builds on the shared helper.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` — local fake builds on the shared helper.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js` — local fake builds on the shared helper.
