# Plan: Scaffold cli/ with esbuild bundling

Issue: [779-scaffold-cli-with-esbuild-bundling.md](../../issues/779-scaffold-cli-with-esbuild-bundling.md)

## Overview

Create the `cli/` project for the `arcanum-cli` npm package: the manifest, the Node-floor gate `cli/bin/arcanum`, a `parseArgs` router with `--help`/`--version` and a `config` namespace stub, the `esbuild` build (`cli/scripts/build.mjs`) with the metafile shared-surface check and the embedded migration-version list, plus lint and specs. `infra` adds the Docker/Makefile `cli-*` targets, the CircleCI `cli` and Node-floor jobs, the `bump-version.sh` lockstep change, and keeps `cli/` out of the release zip and the runtime image. `node` adds the `core/spec` check that the release zip lists no `cli/` path.

## Agents involved

- [client](client.md)
- [infra](infra.md)
- [node](node.md)

## Shared contracts

**`cli/` yarn scripts** (produced by `client`, consumed by `infra`'s Makefile targets and CircleCI jobs), all run from `cli/`:

| Script | Command | Notes |
| --- | --- | --- |
| `build` | `node scripts/build.mjs` | Writes `cli/dist/arcanum.mjs`. |
| `lint` | `eslint .` | |
| `test` | `c8 jasmine` | Includes the smoke specs, which need `dist/`. `test` does **not** build. Callers run `yarn build` before `yarn test`. No `pretest`. |
| `prepack` | `yarn build` | |

- Package manager: Yarn classic (1.22.x). `cli/yarn.lock` is committed and must work with `yarn install --frozen-lockfile`.
- `cli/package.json` is 2-space-indented JSON with a top-level `"version"` key equal to the root `arcanum.version` file (`2.1.0` today). `bump-version.sh` rewrites it with `jq '.version = $v'`, which keeps that formatting.
- The build reads `../core/eslint.config.mjs`, `../core/lib/**` and `../arcanum/migrations/repos/**`, so every runner needs the **full repo** with `cli/` as the working directory (Docker: repo mounted, `working_dir` `.../cli`; CircleCI: `checkout` of the whole repo, `working_directory: ~/project/cli`). The build must work with only `cli/node_modules` installed (no `core/node_modules`).
- `cli/node_modules` holds esbuild's platform-specific binary, so Docker uses its own named volume for it (`cli_node_modules`) and never shares it with a macOS host.
- All specs, smoke specs included, pass on Node 22.13.0 exactly.
- Root `.gitignore` gains `cli/node_modules/`, `cli/coverage/` and `cli/dist/` (`client`).

**Release zip / image exclusion** (produced by `infra`, consumed by `node`'s spec): `scripts/build_release_zip.sh`'s `EXCLUDES` and the mirrored first block of the root `.dockerignore` gain `cli/`, so `build_release_zip.sh --list` prints no `cli/` path.

**Shared-surface list** (consumed by `client`'s `build.mjs`, read-only): the single block in `core/eslint.config.mjs` whose `rules['no-restricted-syntax']` targets `ImportExpression`. Its `files` (relative to `core/`) plus `core/lib/utils/config/keys.json` are the allowed `core/` inputs of the bundle. `core/eslint.config.mjs` is not edited in this issue.

## Execution order

`client` and `infra` run in parallel on the shared contracts above. `infra` verifies its Makefile targets and CI jobs once `client`'s `cli/package.json` and `cli/yarn.lock` exist. `node`'s spec passes once `infra`'s `EXCLUDES` change is in.
