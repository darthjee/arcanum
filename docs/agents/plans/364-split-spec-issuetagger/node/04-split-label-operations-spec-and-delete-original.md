# Split the label-operations methods into `IssueTaggerLabelOperations_spec.js` and delete the original

Create `core/spec/lib/utils/issue/IssueTaggerLabelOperations_spec.js` with a single top-level
`describe('IssueTagger (label operations)', ...)` containing five nested `describe`s —
`#fetchLabels`, `#addLabel`, `#removeLabel`, `#hasLabel`, `#warnMutationFailure` — moved
verbatim from `IssueTagger_spec.js` lines 209–303 (11 `it`s total: 2 + 2 + 2 + 3 + 2). Import
`fakeIssueClient`, `newTagger`, and `REPO` from `core/spec/support/factories/issueTagger.js`
(step 01) instead of defining/closing over them inline. Keep the `DispatchFailure` import,
used by the `#hasLabel` block's "not a DispatchFailure" assertion; this file does not need
`captureStdout` (none of these methods write to stdout). Once this file is in place and
verified, delete `core/spec/lib/utils/issue/IssueTagger_spec.js` — every one of its `it`s now
lives in one of the three new files, and nothing else imports the deleted file directly. Do
not touch `core/lib/utils/issue/IssueTagger.js`.

## Files to Change

- `core/spec/lib/utils/issue/IssueTaggerLabelOperations_spec.js` — new file, ~110 lines, the 5
  nested describes / 11 `it`s moved verbatim from `IssueTagger_spec.js`, importing
  `fakeIssueClient`/`newTagger`/`REPO` from the factory module instead of defining them
  inline.
- `core/spec/lib/utils/issue/IssueTagger_spec.js` — deleted; fully superseded by the three new
  files plus the factory module.
