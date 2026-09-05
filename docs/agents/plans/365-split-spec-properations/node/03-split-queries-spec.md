# Split query-method scenarios into PrOperationsQueries_spec.js

Create `core/spec/lib/utils/github/PrOperationsQueries_spec.js` with a top-level
`describe('PrOperations (query methods)', () => { ... })` (matches the split table in the
issue), containing the three nested `describe`s moved verbatim from `PrOperations_spec.js`:

- `'#prState'`, with all 5 of its `it`s (`'prints STATE=OPEN for an open, unmerged pull
  request'`, `'prints STATE=MERGED for a merged pull request, even though its raw state is
  "closed"'`, `'prints STATE=CLOSED for a closed, unmerged pull request'`, `'rejects with the
  not-found error when no pull request is found'`, `'never calls context.getToken() or
  context.resolveWithRef() directly'`)
- `'#headSha'`, with its 1 `it` (`'delegates to githubClient.getPrHeadSha() and returns its
  result'`)
- `'#checkRuns'`, with its 1 `it` (`'delegates to githubClient.getCheckRuns() and returns its
  result'`)

Import `newPrOperations` from `core/spec/support/factories/prOperations.js` (step 01) instead
of redefining it locally.

`PrOperations_spec.js` is left untouched in this step — the temporary scenario duplication with
the original file is expected and resolves in step 04.

## Files to Change

- `core/spec/lib/utils/github/PrOperationsQueries_spec.js` — new file; the `#prState`,
  `#headSha`, and `#checkRuns` scenarios moved verbatim from `PrOperations_spec.js:113-173`,
  importing `newPrOperations` from `core/spec/support/factories/prOperations.js`.
