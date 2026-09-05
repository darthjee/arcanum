# Remove the original spec file and verify

Delete `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` now that every
`it` it contained has moved into
`ArcanumUpdateRunUpdateCheck_spec.js` and `ArcanumUpdateRunUpdateApply_spec.js` (steps 02–03),
backed by the shared factory module (step 01).

Then verify:

- `make core-test` passes, with the same total spec count as before this split (10 `it`s,
  now split 6/4 across the two new files instead of all 10 in the deleted file).
- `make core-lint` is clean.
- Coverage for `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` is unchanged from
  before the split (same lines/branches exercised).

## Files to Change

- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` — deleted.
