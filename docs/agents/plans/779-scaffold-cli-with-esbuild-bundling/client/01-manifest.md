# Manifest, lockfile and gitignore

Create `cli/package.json` per [Packaging and Release → `cli/package.json`](../../../specs/arcanum-cli/packaging-and-release.md#clipackagejson):

- `name: "arcanum-cli"`, `version: "2.1.0"` (equal to the root `arcanum.version` file), `description`, `homepage`, `repository` (`darthjee/arcanum`, `directory: "cli"`), `bugs`. No `license` field.
- `type: "module"`, `bin: {"arcanum": "bin/arcanum"}`, `files: ["bin/", "dist/", "README.md"]`, `engines.node: ">=22.13.0"` (equal to `core/package.json`'s).
- `scripts`: `build`, `prepack`, `test`, `lint`, exactly as in the shared contracts. No install lifecycle scripts.
- No `dependencies`, `optionalDependencies` or `peerDependencies`.
- Exact devDependency versions, no `^`: `@eslint/js` 10.0.1, `c8` 12.0.0, `eslint` 10.8.1, `eslint-plugin-jsdoc` 63.3.3, `globals` 17.11.0, `jasmine` 7.0.0, `esbuild` 0.28.2.
- `publishConfig: {"access": "public", "tag": "latest"}`. No `private`.
- A `c8` block mirroring core's. Keep `scripts/build.mjs` covered and exclude `dist/**` and `spec/**`.
- 2-space JSON formatting.

Run `yarn install` in `cli/` to produce `cli/yarn.lock` and commit it. Add `cli/node_modules/`, `cli/coverage/` and `cli/dist/` to the root `.gitignore`.

## Files to Change

- `cli/package.json` — new manifest.
- `cli/yarn.lock` — new, committed lockfile.
- `.gitignore` — the three `cli/` entries.
