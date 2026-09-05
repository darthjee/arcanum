# node Plan: Split spec PrOperations

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared spec helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split #prNumber scenarios into PrOperationsPrNumber_spec.js](node/02-split-prnumber-spec.md)
- [03 — Split query-method scenarios into PrOperationsQueries_spec.js](node/03-split-queries-spec.md)
- [04 — Split #prMerge scenarios into PrOperationsPrMerge_spec.js and delete the original spec](node/04-split-prmerge-spec-and-cleanup.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Every `it` moves verbatim — no assertion or fake-behavior changes anywhere in this plan.
  `PrOperations.js` itself is never touched.
- Steps 02–03 temporarily duplicate scenarios between the original file and the new split
  files (same shape as issue #360/#361's `AutoFixAllQueue`/`AutoFixAllWaitCi` splits); step 04
  both finishes the split and deletes `PrOperations_spec.js`, removing the duplication. Total
  test count only matches the original again once step 04 lands — an intermediate step alone
  will show a higher count, which is expected.
- Run `make core-test` after every step to confirm the suite stays green throughout, and once
  more after step 04 to confirm the total spec count matches the pre-split baseline (21 `it`s:
  5 `#prNumber` + 5 `#prState` + 1 `#headSha` + 1 `#checkRuns` + 9 `#prMerge`, the last
  including the 2 nested `"coauthors" mode` `it`s — the issue's own "11" figure for `#prMerge`
  over-counts by 2; the plan below moves every `it` that actually exists in the file today).
- `core/spec/support/factories/` has no barrel/index file per existing convention (see sibling
  `autoFixAllWaitCi.js`, `autoFixAllQueue.js`, `repoContextFactory.js`) — each new spec file
  imports directly from `prOperations.js`.
- `newPrOperations` keeps composing `createRepoContextMock` from the existing
  `core/spec/support/factories/repoContextFactory.js`, per the issue.
