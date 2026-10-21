# Specs

Set up Jasmine with c8 (`cli/spec/support/jasmine.json`, ESM), mirroring `cli/lib/` one to one, and add:

- **`spec/lib/**`:**
  - the router: `--help`, `--version`, `--version --json`, no command and unknown command (exit `2`);
  - the `config` stub help listing registry keys;
  - the error-to-exit-code mapping;
  - help helpers.
- **`spec/scripts/build_spec.js`:**
  - `migrationVersions` on fixture `repos/` trees in temp dirs: `next/` skipped, non-semver dirs skipped, `0.9.3` before `0.13.0`, versions above the CLI version dropped, scope by `applies_to`, and a throw on a non-array file or an invalid/missing `applies_to`;
  - one run against the real `../arcanum/migrations/repos/` that succeeds;
  - `sharedSurface()` returns the real list, including `keys.json`;
  - `checkInputs` rejects a fixture metafile with an outside input and accepts a valid one.
- **`spec/packaging/manifest_spec.js`:**
  - `name`, `bin`, `files`, `type` and `publishConfig`;
  - no `dependencies`/`optionalDependencies`/`peerDependencies` and no install lifecycle scripts;
  - every devDependency version is exact.
- **`spec/packaging/lockstep_spec.js`:**
  - `version` equals the root `arcanum.version`;
  - `engines.node` equals `core/package.json`'s;
  - the floor literal in `bin/arcanum` equals `engines.node`.
- **`spec/packaging/eslintBoundary_spec.js`:** the ESLint API `lintText` with a fake `filePath` under `lib/` rejects a `core/lib` import outside the surface entry files and accepts an allowed one.
- **`spec/bin/arcanum_spec.js`** (the gate): with a faked older `process.versions.node`, it exits `1` with the required-version message. For example, use a `node --import data:…` preload that redefines `process.versions`; check during implementation that this works on Node 22.13.
- **`spec/smoke/bundle_spec.js`** (needs `yarn build` first):
  - copy `bin/` and `dist/` into a temp dir outside the repo, so the run proves the bundle is self-contained;
  - run `node <tmp>/bin/arcanum` for `--version` (`arcanum-cli 2.1.0`), `--help` (exit `0`) and an unknown command (exit `2`);
  - run `config --help` and check it prints a key name read from `core/lib/utils/config/keys.json`.

Then run `yarn lint && yarn build && yarn test` from `cli/` and fix any failure.

## Files to Change

- `cli/spec/support/jasmine.json` — new Jasmine config.
- `cli/spec/lib/**` — new unit specs mirroring `cli/lib/`.
- `cli/spec/scripts/build_spec.js` — new build-helper specs.
- `cli/spec/packaging/manifest_spec.js`, `cli/spec/packaging/lockstep_spec.js`, `cli/spec/packaging/eslintBoundary_spec.js` — new packaging specs.
- `cli/spec/bin/arcanum_spec.js` — new gate spec.
- `cli/spec/smoke/bundle_spec.js` — new smoke specs on the built bundle.
