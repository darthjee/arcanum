# Delete the original and verify

Delete `core/spec/lib/core/dispatcher_spec.js` — every `it` now lives in one of the four new
files from steps 01–04.

Cross-check before running the suite:

- 21 `it`s total across the four new files (8 + 4 + 2 + 7), matching the original.
- No `it` is duplicated or dropped; each moved verbatim (same title, same body).
- Every new file's top-level `describe` wrapper is `Dispatcher (<concern>)`; the original
  inner sub-`describe`s are unchanged inside.

Then run the checks from `core/`:

- `make core-test` — passes, with the same total spec count as before the split.
- `make core-lint` — clean (no unused imports left behind in any new file; `eslint .`).
- Confirm coverage for `core/lib/core/dispatcher.js` is unchanged (`c8` output from
  `make core-test`).

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — deleted.
