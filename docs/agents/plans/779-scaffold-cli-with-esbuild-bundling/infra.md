# Infra Plan: Scaffold cli/ with esbuild bundling

Main plan: [plan.md](plan.md)

## Shared contracts

What you can rely on from `client` (working in parallel in the same worktree):

- Yarn scripts, run from `cli/`: `build` = `node scripts/build.mjs` (writes `cli/dist/arcanum.mjs`), `lint`, `test` = `c8 jasmine` (smoke specs included; it does **not** build, so always run `yarn build` before `yarn test`).
- A committed `cli/yarn.lock` (Yarn classic) for `yarn install --frozen-lockfile`.
- `cli/package.json`: 2-space JSON with a top-level `"version"` equal to `arcanum.version`.
- The build reads `../core/eslint.config.mjs`, `../core/lib/**` and `../arcanum/migrations/repos/**`, so it needs the full repo with `cli/` as the working directory. It needs only `cli/node_modules`.
- esbuild ships a platform-specific binary, so `cli/node_modules` needs its own named Docker volume.

What you produce:

- `cli/` in `scripts/build_release_zip.sh`'s `EXCLUDES` and in the mirrored first block of the root `.dockerignore`. `node`'s new `core/spec` check relies on it.
- Makefile targets `cli-install`, `cli-lint`, `cli-build`, `cli-test` (build then test), `cli-check` (lint then test), `cli-shell`, `cli-audit`.
- CircleCI jobs `cli` and `cli-node-floor` in the `test` workflow.

## Steps

- [01 — Keep cli/ out of the release zip and image](infra/01-release-exclusion.md)
- [02 — Docker and Makefile cli-* targets](infra/02-docker-and-makefile.md)
- [03 — bump-version.sh lockstep](infra/03-bump-version.md)
- [04 — CircleCI cli and floor jobs](infra/04-circleci.md)

## CI Checks

- `cli/`: `make cli-check` (CI jobs: `cli`, `cli-node-floor`)
- `core/`: `make core-check` (CI jobs: `test`, `checks`). `core/docker-entrypoint.sh` and `.dockerignore` affect the core image.
- `scripts/test_bump_version.sh` (run by hand, not in CI).

## Notes

- `client` creates `cli/` in parallel. Write the targets and jobs against the contract above, then verify them (`make cli-check`) once `cli/package.json` and `cli/yarn.lock` exist in the worktree. If they never appear, report that instead of creating them.
- `darthjee/circleci_node:0.2.1` runs Node 22.14.0, so it is not the floor. For the floor job, use `cimg/node:22.13.0`. If that tag does not exist, use the closest 22.13.x tag and note it in your report.
- No Codacy coverage upload for `cli/` in this issue.
