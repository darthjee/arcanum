# Split #prNumber scenarios into PrOperationsPrNumber_spec.js

Create `core/spec/lib/utils/github/PrOperationsPrNumber_spec.js` with a top-level
`describe('PrOperations#prNumber', () => { ... })` (no nested "PrOperations" wrapper — matches
the split table in the issue), containing all 5 `it`s moved verbatim (assertions unchanged)
from the `#prNumber` block in `PrOperations_spec.js`:

- `'returns the cached pr_id when the branch matches issue-<id> and a cache entry exists'`
- `'falls back to a REST lookup when the branch does not match issue-<id>'`
- `'falls back to a REST lookup when the branch matches issue-<id> but no cache entry exists'`
- `'rejects with the not-found error when no pull request is found'`
- `'never calls context.getToken() or context.resolveWithRef() directly'`

Import `newPrOperations` from the new `core/spec/support/factories/prOperations.js` (step 01)
instead of redefining it locally.

`PrOperations_spec.js` is left untouched in this step — these scenarios still exist there too
until step 04 deletes the file; the temporary duplication is expected and resolves once the
original file is removed.

## Files to Change

- `core/spec/lib/utils/github/PrOperationsPrNumber_spec.js` — new file; the `#prNumber`
  scenarios moved verbatim from `PrOperations_spec.js:76-111`, importing `newPrOperations` from
  `core/spec/support/factories/prOperations.js`.
