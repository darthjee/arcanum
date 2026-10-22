# Folder build check

In `cli/scripts/build.mjs`, make the metafile check folder-based: a bundled input passes when it starts with `cli/lib/` or `core/lib/shared/` (this covers `keys.json`); anything else fails with the existing "bundled inputs outside ..." error, reworded to name `core/lib/shared/**`. Keep ignoring esbuild's `<define:...>` virtual inputs.

Remove `sharedSurface()`, `targetsImportExpression()`, `bareSpecifierStubPlugin()` (if only used there) and the `KEYS_JSON` constant: the build no longer reads core's ESLint config. `checkInputs()` takes the allowed folder prefixes instead of a file list (or hard-codes them; keep it injectable enough for the specs). Update the header comment.

Update `cli/spec/scripts/build_spec.js`: drop the `SURFACE` list and the `sharedSurface` describe; `checkInputs` cases cover an input under `core/lib/shared/` (passes), one under `core/lib/context/` (fails) and one at an old `core/lib/utils/` path (fails); the build case expects `core/lib/shared/config/keys.json` among the inputs.

## Files to Change
- `cli/scripts/build.mjs` — folder-based input check, remove ESLint-config parsing
- `cli/spec/scripts/build_spec.js` — matching cases
