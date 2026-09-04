# Split transient-error/auth scenarios into AutoFixAllWaitCiTransientErrors_spec.js and delete the original spec

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiTransientErrors_spec.js` with a
top-level `describe('AutoFixAllWaitCi (transient errors & auth)', () => { describe('#run', ()
=> { ... }) })` wrapper, containing:

- the `'transient fetch/API errors'` nested `describe` moved verbatim, with all three of its
  `it`s (`'retries (does not raise) when the head-commit fetch is not ok'`, `'retries (does not
  raise) when the check-runs fetch is not ok'`, `'retries (does not raise) when a poll-loop
  fetch call rejects outright'`) plus the trailing explanatory comment about the malformed
  ignored-pattern regex case now living at the `PrChecker` layer
- the bare `it('sends the resolved GitHub token as a bearer header on every REST call', ...)`,
  moved as a sibling `it` directly under the same `describe('#run')` (it is not nested inside
  the `'transient fetch/API errors'` describe in the original file either — keep it at that
  same level here)

Import `fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, `stubRepoConfig` from
`core/spec/support/factories/autoFixAllWaitCi.js` (step 01) instead of redefining them locally.

Then delete `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCi_spec.js` entirely — every
scenario it held now lives in one of the four new files from steps 02–05, so this is the step
that resolves the temporary duplication introduced by those steps back down to the original
total test count.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiTransientErrors_spec.js` — new file; the
  transient-error scenarios and the bearer-token `it` moved verbatim from
  `AutoFixAllWaitCi_spec.js:268-349`, importing helpers from
  `core/spec/support/factories/autoFixAllWaitCi.js`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCi_spec.js` — deleted; fully superseded by
  the four new sibling spec files.

## Notes

- After this step, run `make core-test` and confirm the total spec/`it` count matches the
  pre-split baseline (351-line original file's scenario count), and `make core-lint` is clean.
