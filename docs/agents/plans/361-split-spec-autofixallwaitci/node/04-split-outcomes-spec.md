# Split check-run outcome scenarios into AutoFixAllWaitCiOutcomes_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiOutcomes_spec.js` with a top-level
`describe('AutoFixAllWaitCi (check-run outcomes)', () => { describe('#run', () => { ... }) })`
wrapper, containing the following nested `describe`s moved verbatim from
`AutoFixAllWaitCi_spec.js`:

- `'when zero check-runs are registered yet'` (`'keeps polling until check-runs show up'`)
- `'when every (non-ignored) check-run has completed successfully'` (`'resolves with
  "passed\n"'`)
- `'when a check-run has completed with a failure/cancelled/timed_out conclusion'` (`'resolves
  with "failed\n" plus each failed check-run's name'`)
- `'when a check-run is still pending'` (`'keeps polling until every check-run has
  completed'`)

Import `fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, `stubRepoConfig` from
`core/spec/support/factories/autoFixAllWaitCi.js` (step 01) instead of redefining them locally.

`AutoFixAllWaitCi_spec.js` is left untouched in this step — the temporary scenario duplication
with the original file is expected and resolves in step 05.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiOutcomes_spec.js` — new file; the
  zero-check-runs, all-success, failure/cancelled/timed-out, and still-pending scenarios moved
  verbatim from `AutoFixAllWaitCi_spec.js:155-266`, importing helpers from
  `core/spec/support/factories/autoFixAllWaitCi.js`.
