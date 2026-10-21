# esbuild build

Create `cli/scripts/build.mjs` per [Shared Config Logic → Bundle at build time with `esbuild`](../../../specs/arcanum-cli/shared-config-logic.md#bundle-at-build-time-with-esbuild) and [Packaging and Release → Build output](../../../specs/arcanum-cli/packaging-and-release.md#build-output). Export pure helpers so specs can call them, and run the build only when the file is invoked directly.

- **Build:** esbuild JS API with `entryPoints: ['lib/main.js']`, `outfile: 'dist/arcanum.mjs'`, `bundle: true`, `platform: 'node'`, `format: 'esm'`, `target: 'node' + <floor from engines.node>` (`node22.13`), `minify: false`, `sourcemap: false`, and `metafile: true`. The `define` values are:
  - `__ARCANUM_CLI_VERSION__` from `package.json`;
  - `__ARCANUM_MIGRATION_VERSIONS__`, from the list below.
- **`sharedSurface()`:** reads the surface list from `../core/eslint.config.mjs` without needing `core/node_modules`.
  - Bundle that file in memory (`write: false`, `format: 'esm'`, `platform: 'node'`), with an `onResolve` plugin that maps every bare specifier to a stub `export default { configs: {} }`.
  - Import the output through a `data:text/javascript;base64,…` URL.
  - Pick the one block whose `rules['no-restricted-syntax']` targets `ImportExpression`, and fail loudly unless there is exactly one.
  - Return its `files` mapped to `core/<f>`, plus `core/lib/utils/config/keys.json`.
- **`checkInputs(metafile, allowed)`:** fails if any bundled input (repo-relative) lies outside `cli/lib/**` and `allowed`.
- **`migrationVersions(reposDir, cliVersion)`:** per [Packaging and Release → Embedded migration-version list](../../../specs/arcanum-cli/packaging-and-release.md#embedded-migration-version-list).
  - Reads every `<dir>/migrations.json` under `reposDir` and counts only bare `X.Y.Z` directories, so `next/` and non-semver names are skipped.
  - Lists a version under every scope its entries' `applies_to` names (`repo`, `local` or `global`).
  - Drops versions greater than `cliVersion` and sorts each list by semver.
  - Throws on a non-array file or a missing/invalid `applies_to`.
- On any failure, the build exits non-zero with a clear message.

## Files to Change

- `cli/scripts/build.mjs` — new build script with exported helpers.
