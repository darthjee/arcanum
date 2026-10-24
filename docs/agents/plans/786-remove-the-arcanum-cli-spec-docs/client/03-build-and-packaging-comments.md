# Build, packaging and lint comments

Repoint the comments that cite `shared-config-logic.md` or `packaging-and-release.md` to `docs/agents/architecture/shared-lib.md` and `docs/agents/architecture/install-and-release.md`.

## Files to Change
- `cli/scripts/build.mjs` (lines 2–3): `shared-config-logic.md#bundle-at-build-time-with-esbuild` → `architecture/shared-lib.md#the-cli-bundle`, and `packaging-and-release.md#build-output` → `architecture/install-and-release.md#build-output`
- `cli/scripts/build.mjs` (line 120), `cli/lib/main.js` (line 49): `packaging-and-release.md#embedded-migration-version-list` → `architecture/install-and-release.md#build-output`
- `cli/lib/exitCodes.js` (line 139): `shared-config-logic.md#configerror` → `architecture/shared-lib.md#configerror`
- `cli/eslint.config.mjs`: `shared-config-logic.md` (the import rule) → `architecture/shared-lib.md#import-boundary`
