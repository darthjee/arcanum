# Packaging spec

Guard that installs keep getting `shared/`.

In `core/spec/release/buildReleaseZipList_spec.js`:

- Add `shared/package.json` (needed for `"type": "module"` so the ESM imports resolve) and a concrete lib file such as `shared/lib/config/keys.json` to `RUNTIME_FILES`.
- Add an `it('lists files under shared/lib/')` asserting at least one listed path starts with a new `SHARED_LIB_PREFIX = 'shared/lib/'` constant.
- Add `shared/eslint.config.mjs` to `DEV_ONLY_FILES`.
- Extend the header comment with an issue #823 line.

No change to `.dockerignore` or `scripts/build_release_zip.sh`; the new cases should pass as-is.

Verify: `make core-test` (and `make core-lint`).

## Files to Change
- `core/spec/release/buildReleaseZipList_spec.js` — new `shared/` assertions and header comment
