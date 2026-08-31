# Update arcanum_spec.js integration tests

`core/spec/bin/arcanum_spec.js` has two describe blocks exercising `dispatch-fixture` end to end that no longer have a subject once the command is removed:

- `'a known command (dispatch-fixture)'` — routes to `DispatchFixture` and prints its success output.
- `'a dev/proof command excluded from logging (dispatch-fixture)'` — the `log: false` integration proof (leaves the log file untouched).

Remove both. Leave every `dispatch-fixture-crash` describe block (`'a known command that crashes (dispatch-fixture-crash)'` and `'a crashing command (dispatch-fixture-crash) with engine.log.location configured'`) untouched — those stay in scope of the separate crash-survival issue (#342).

## Files to Change

- `core/spec/bin/arcanum_spec.js` — remove the two `dispatch-fixture` (non-crash) describe blocks; leave `dispatch-fixture-crash` coverage as-is.
