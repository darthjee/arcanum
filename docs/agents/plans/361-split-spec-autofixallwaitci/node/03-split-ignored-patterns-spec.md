# Split ignored-pattern scenarios into AutoFixAllWaitCiIgnoredPatterns_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiIgnoredPatterns_spec.js` with a
top-level `describe('AutoFixAllWaitCi (ignored check patterns)', () => { describe('#run', () =>
{ ... }) })` wrapper, containing the `'ignored check patterns'` nested `describe` moved
verbatim from `AutoFixAllWaitCi_spec.js`, with both of its `it`s (`'excludes matching
check-runs (case-insensitively) from the passed/failed/total accounting'` and `'is read only
once, not re-read on every poll iteration'`).

Import `fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, `stubRepoConfig` from
`core/spec/support/factories/autoFixAllWaitCi.js` (step 01) instead of redefining them locally.

`AutoFixAllWaitCi_spec.js` is left untouched in this step — the temporary scenario duplication
with the original file is expected and resolves in step 05.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiIgnoredPatterns_spec.js` — new file; the
  ignored-check-patterns scenarios moved verbatim from
  `AutoFixAllWaitCi_spec.js:175-213`, importing helpers from
  `core/spec/support/factories/autoFixAllWaitCi.js`.
