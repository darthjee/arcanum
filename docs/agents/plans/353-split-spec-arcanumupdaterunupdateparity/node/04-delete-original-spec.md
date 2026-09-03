# Delete the original spec file

Delete `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` now that every `it` and helper it
contained has moved verbatim into `arcanumUpdateRunUpdateParitySetup.js`, `check_spec.js`, and
`apply_spec.js` (steps 01–03).

Run `make core-test` and confirm the total spec/`it` count is unchanged from before the split,
and `make core-lint` is clean.

## Files to Change

- `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` — deleted.
