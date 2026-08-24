# Mirror the structure in core/spec/lib/

`core/spec/lib/` must mirror `core/lib/`'s new subfolder structure exactly, per the issue's rules. Do this after steps 01–03 so every `_spec.js` file's target category is settled.

For each `core/spec/lib/<Name>_spec.js` (34 remain after step 03 deletes `Greeter_spec.js`), move it to `core/spec/lib/<same-category-as-its-lib-file>/<Name>_spec.js` — use the finalized category breakdown table in [the issue](../../issues/285-reorganize-core-lib.md) to look up each file's category (`commands/` or `utils/<domain>/`).

Moving one directory level deeper changes the relative import depth: a spec currently does `import X from '../../lib/X.js'` (two `../` from `core/spec/lib/`). After the move it needs one more `../` for the added subfolder: `import X from '../../../lib/<category>/X.js'` from `core/spec/lib/<category>/`. Apply the same one-more-`../` correction to any other relative import inside the spec (e.g. shared spec helpers/fixtures under `core/spec/support/`).

Also close the pre-existing spec-mirror gap: add `core/spec/lib/utils/errors/DispatchFailure_spec.js`, since `DispatchFailure.js` currently has no dedicated spec (only exercised indirectly via other specs). Follow this repo's existing spec conventions (Jasmine `describe`/`it`/`expect`, see e.g. `core/spec/lib/Tags_spec.js` for style). Cover: the constructor stores `stdout` verbatim on `.stdout`; `exitCode` defaults to `1` when omitted; an explicit `exitCode` argument is stored on `.exitCode`; and the instance is an `instanceof Error` (and `instanceof DispatchFailure`) with message `'dispatch failure'`.

## Files to Change

- All 34 remaining `core/spec/lib/*_spec.js` files — moved into `core/spec/lib/commands/` or `core/spec/lib/utils/<domain>/` per the category breakdown table, with import paths corrected for the added directory depth
- `core/spec/lib/utils/errors/DispatchFailure_spec.js` — new file, spec for `DispatchFailure.js`
