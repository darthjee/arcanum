# Split usage & no-PR scenarios into AutoFixAllWaitCiUsage_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiUsage_spec.js` with a top-level
`describe('AutoFixAllWaitCi (usage & no PR)', () => { describe('#run', () => { ... }) })`
wrapper, containing the following `it`s moved verbatim (assertions unchanged) from
`AutoFixAllWaitCi_spec.js`:

- `'throws the usage message when repo_path is missing'`
- the `'when no pull request is found for the current branch'` nested `describe`, with both of
  its `it`s (`'throws the same error message the shell script prints'` and `'also throws when
  the pulls lookup itself fails'`)

Import `fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, `stubRepoConfig` from the new
`core/spec/support/factories/autoFixAllWaitCi.js` (step 01) instead of redefining them locally.

`AutoFixAllWaitCi_spec.js` is left untouched in this step — these scenarios still exist there
too until step 05 deletes the file; the temporary duplication is expected and resolves once
the original file is removed.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiUsage_spec.js` — new file; the usage and
  no-PR-found scenarios moved verbatim from
  `AutoFixAllWaitCi_spec.js:126-154`, importing helpers from
  `core/spec/support/factories/autoFixAllWaitCi.js`.
