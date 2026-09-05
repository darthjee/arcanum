# Split `#mutateTag` into `IssueTaggerMutateTag_spec.js`

Create `core/spec/lib/utils/issue/IssueTaggerMutateTag_spec.js` with a single top-level
`describe('IssueTagger#mutateTag', ...)` containing the current `#mutateTag` block's 7 `it`s
(`IssueTagger_spec.js` lines 138–206) moved verbatim, unchanged. Import `fakeIssueClient`,
`newTagger`, and `REPO` from `core/spec/support/factories/issueTagger.js` (step 01) instead of
defining/closing over them inline. Keep the existing `captureStdout` import — used throughout
this block. `DispatchFailure` is not needed here (no `#mutateTag` assertion checks it), so
drop that import in this file. Do not touch `core/lib/utils/issue/IssueTagger.js`.

## Files to Change

- `core/spec/lib/utils/issue/IssueTaggerMutateTag_spec.js` — new file, ~75 lines, the 7
  `#mutateTag` `it`s moved verbatim from `IssueTagger_spec.js`, importing
  `fakeIssueClient`/`newTagger`/`REPO` from the factory module instead of defining them
  inline.
