# node Plan: Split spec AutoFixAllWaitCi

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared spec helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split usage & no-PR scenarios into AutoFixAllWaitCiUsage_spec.js](node/02-split-usage-spec.md)
- [03 — Split ignored-pattern scenarios into AutoFixAllWaitCiIgnoredPatterns_spec.js](node/03-split-ignored-patterns-spec.md)
- [04 — Split check-run outcome scenarios into AutoFixAllWaitCiOutcomes_spec.js](node/04-split-outcomes-spec.md)
- [05 — Split transient-error/auth scenarios into AutoFixAllWaitCiTransientErrors_spec.js and delete the original spec](node/05-split-transient-errors-spec-and-cleanup.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Every `it` moves verbatim — no assertion or fake-behavior changes anywhere in this plan.
- Steps 02–04 temporarily duplicate scenarios between the original file and the new split
  file (same shape as issue #360's `AutoFixAllQueue` split); step 05 both finishes the split
  and deletes `AutoFixAllWaitCi_spec.js`, removing the duplication. Total test count only
  matches the original again once step 05 lands — an intermediate step alone will show a
  higher count, which is expected.
- Run `make core-test` after every step to confirm the suite stays green throughout, and once
  more after step 05 to confirm the total spec count matches the pre-split baseline.
- `core/spec/support/factories/` has no barrel/index file per existing convention (see
  sibling `autoFixAllQueue.js`, `autoFixAllGithub.js`) — each new factory file is imported
  directly by the specs that need it.
