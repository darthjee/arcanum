# Build allow-list

In `cli/scripts/build.mjs`:

- `ALLOWED_INPUT_DIRS` becomes `['cli/lib/', 'shared/lib/']`;
- update the header comment ("the shared surface folder, shared/lib/**") and the docblock near line 85.

In `cli/spec/scripts/build_spec.js`, update the default allow-list expectation and the accepted-inputs fixture: `../shared/lib/config/KeyRegistry.js`, `../shared/lib/config/keys.json` and `../shared/lib/file/Lock.js`, plus their repo-relative forms. Add a case showing that a `core/lib/...` input is now rejected.

## Files to Change

- `cli/scripts/build.mjs`: the allow-list and comments.
- `cli/spec/scripts/build_spec.js`: the expectations.
