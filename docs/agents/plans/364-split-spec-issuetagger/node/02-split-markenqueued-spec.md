# Split `#markEnqueued` into `IssueTaggerMarkEnqueued_spec.js`

Create `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js` with a single top-level
`describe('IssueTagger#markEnqueued', ...)` containing the current `#markEnqueued` block's 5
`it`s (`IssueTagger_spec.js` lines 54–134) moved verbatim, unchanged. Import `fakeIssueClient`,
`newTagger`, and `REPO` from the new `core/spec/support/factories/issueTagger.js` module
(step 01) instead of defining/closing over them inline. Keep the existing imports for
`DispatchFailure` and `captureStdout` — both are used by this block's assertions. Do not touch
`core/lib/utils/issue/IssueTagger.js`.

## Files to Change

- `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js` — new file, ~95 lines, the 5
  `#markEnqueued` `it`s moved verbatim from `IssueTagger_spec.js`, importing
  `fakeIssueClient`/`newTagger`/`REPO` from the factory module instead of defining them
  inline.
