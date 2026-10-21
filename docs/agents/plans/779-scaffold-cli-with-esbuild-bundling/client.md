# Client Plan: Scaffold cli/ with esbuild bundling

Main plan: [plan.md](plan.md)

## Shared contracts

What you produce for `infra`:

- Yarn scripts, run from `cli/`: `build` = `node scripts/build.mjs` (writes `cli/dist/arcanum.mjs`), `lint` = `eslint .`, `test` = `c8 jasmine` (smoke specs included; it does **not** build, so no `pretest`), `prepack` = `yarn build`.
- A committed `cli/yarn.lock` (Yarn classic) that works with `yarn install --frozen-lockfile`.
- `cli/package.json`: 2-space JSON, top-level `"version"` equal to the root `arcanum.version` file (`2.1.0`). `infra`'s `bump-version.sh` rewrites it with `jq '.version = $v'`.
- Root `.gitignore` entries: `cli/node_modules/`, `cli/coverage/`, `cli/dist/`.
- The build works from `cli/` with only `cli/node_modules` installed (no `core/node_modules`), reading `../core/eslint.config.mjs`, `../core/lib/**` and `../arcanum/migrations/repos/**`.
- Every spec, smoke specs included, passes on Node 22.13.0, with no `ExperimentalWarning` on stderr.

What you can rely on:

- `infra` adds `cli/` to `scripts/build_release_zip.sh`'s `EXCLUDES` and to `.dockerignore`, and adds the Makefile `cli-*` targets (`cli-install`, `cli-lint`, `cli-build`, `cli-test`, `cli-check`, `cli-shell`, `cli-audit`) and the CircleCI jobs.
- The shared-surface list: the one block in `core/eslint.config.mjs` whose `rules['no-restricted-syntax']` targets `ImportExpression`. Read it, never edit it.

## Steps

- [01 — Manifest, lockfile and gitignore](client/01-manifest.md)
- [02 — Lint config](client/02-lint-config.md)
- [03 — Node-floor gate and router](client/03-gate-and-router.md)
- [04 — esbuild build](client/04-build.md)
- [05 — Specs](client/05-specs.md)
- [06 — README and folder-structure row](client/06-readme-and-docs.md)

## CI Checks

- `cli/`: `yarn install --frozen-lockfile && yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`, added by `infra` in this same PR). Once `infra`'s targets exist: `make cli-check`.

## Notes

- Specs use temp dirs only and never touch the real `~/.claude`.
- `child_process` only through `execFile`/`spawn` with argument arrays.
- None of the surface modules has import-time side effects, so `esbuild` drops anything unused. The surface check asserts "bundled inputs ⊆ allowed", not "allowed ⊆ inputs". `ConfigChain` and the other surface files arrive with #780.
- To verify during implementation: Node 22.13 runs the `data:`-URL import used in step 04 cleanly, and the `keys.json` JSON import raises no `ExperimentalWarning` at the floor. If it does, report back instead of working around it in `core/lib`. The spec's fallback (`keys.json` → `keys.js`) is `node`'s change.
- Do not edit `core/` or anything owned by `infra`.
