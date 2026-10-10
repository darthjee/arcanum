# Fix specs that relied on the old status

Flipping real statuses to `"docker"` may break specs that read the real `arcanum/_lib/migration-status.json` and assumed `"native"`. Run `make core-test` after scripter step 01 and fix whatever fails. Likely candidates:

- `core/spec/lib/core/dispatcherContextRouting_spec.js` and `core/spec/lib/core/dispatcherInvocationLog_spec.js` (both use `auto-fix-all-config-get`).
- `core/spec/support/factories/engineDispatchDockerSetup.js` and `core/spec/bin/arcanum_spec.js` (both use `dispatch-fixture-crash`/`auto-fix-all-config-get`). Dispatch-level specs should keep using their fixture status map, not the real one.
- `core/spec/lib/core/commands_spec.js`, if it asserts on statuses.

## Files to Change

- Whichever of the files above fail; no change if they all pass.
