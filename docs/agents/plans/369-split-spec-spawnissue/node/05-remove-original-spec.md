# Remove the original spec file and verify

Delete `core/spec/lib/commands/shared/SpawnIssue_spec.js` now that every `it` it contained has
moved into `SpawnIssueRetry_spec.js`, `SpawnIssuePostCreate_spec.js`, and
`SpawnIssueArgumentValidation_spec.js` (steps 02–04), backed by the shared factory module
(step 01).

Then verify:

- `make core-test` passes, with the same total spec count as before this split (10 `it`s, now
  split 4/3/3 across the three new files instead of all 10 in the deleted file).
- `make core-lint` is clean.
- Coverage for `core/lib/commands/shared/SpawnIssue.js` is unchanged from before the split
  (same lines/branches exercised).

## Files to Change

- `core/spec/lib/commands/shared/SpawnIssue_spec.js` — deleted.
