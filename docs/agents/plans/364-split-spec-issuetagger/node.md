# node Plan: Split spec IssueTagger

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared spec helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split `#markEnqueued` into `IssueTaggerMarkEnqueued_spec.js`](node/02-split-markenqueued-spec.md)
- [03 — Split `#mutateTag` into `IssueTaggerMutateTag_spec.js`](node/03-split-mutatetag-spec.md)
- [04 — Split the label-operations methods into `IssueTaggerLabelOperations_spec.js` and delete the original](node/04-split-label-operations-spec-and-delete-original.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- No change to `core/lib/utils/issue/IssueTagger.js` or any collaborator (`IssueClient`,
  `Tags`, `DispatchFailure`) — every `it` moves verbatim, assertions unchanged.
- Do the factory extraction first (step 01) so steps 02–04 can each import from it directly,
  matching the commit order used for the prior spec-split issues (#358–#361, #362, #363):
  extract helpers, then split one new spec file per commit, deleting the original only in the
  last step once nothing else still needs it.
- `newTagger` continues to compose `createRepoContextMock` from the existing
  `core/spec/support/factories/repoContextFactory.js` — that import stays, only the two
  inline `IssueTagger`-specific helpers move into the new factory.
- `Tags_spec.js` is untouched — out of scope per the issue.
