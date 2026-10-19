# Update packaging-and-release.md and key-registry.md

Align the two parts that touch the bundle with the `esbuild` decisions.

- **`packaging-and-release.md`:**
  - `### Code layout`: add `cli/scripts/build.mjs` (build + metafile surface check) and `cli/dist/` (gitignored bundle output).
  - `### cli/package.json`: `"build": "node scripts/build.mjs"`, `"prepack": "yarn build"`, `files: ["bin/", "dist/", "README.md"]`.
  - `### Build output`: name the output (`cli/dist/arcanum.mjs`), state that `cli/bin/arcanum` is not bundled and dynamically imports it after the Node-floor gate, and link Shared Config Logic for the options.
  - `### Release`: the publish job runs the same `yarn build` as the CI `cli` job.
- **`key-registry.md`** (`### Location`, the static-JSON-import bullet): add that `node` verifies on Node 22.13 that the unbundled import prints no `ExperimentalWarning` (stderr would break the dispatcher contract); fallback is `keys.js` with `export default [...]`, transparent to `esbuild` and to the array-of-entries rule.

## Files to Change
- `docs/agents/specs/arcanum-cli/packaging-and-release.md` — layout, package.json scripts/files, build output, release build.
- `docs/agents/specs/arcanum-cli/key-registry.md` — JSON-import verification and `keys.js` fallback.
