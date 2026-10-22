# Issue: Dev container and CI for shared/

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent); see [the shared lib spec](docs/agents/specs/shared-lib.md#tooling-and-ci). Item 6 of its implementation order, after #822 (scaffold and copy, merged).

Give `shared/` its own dev container, Makefile targets, CI jobs, Node-floor run, Codacy coverage upload, and a packaging guard, so `shared/`'s tooling is gated before #824 switches `core/` and `cli/` onto it.

## Problem

`shared/` exists since #822, but nothing runs it:

- No compose service or `shared-*` Makefile targets; its README tells you to run `yarn` on the host.
- No CircleCI job, so its lint, specs and coverage thresholds are not gated, and the CLI's Node 22.13 floor is not checked for code the CLI will ship.
- No Codacy coverage. Core's `test` job uploads a single full report today, so adding a second report for the same commit would overwrite instead of merge.
- `.codacy.yml` only carries core's entries (PMD false positives, lockfile, spec support).
- Nothing guards that the release zip keeps shipping `shared/lib/` and `shared/package.json` (without it `"type": "module"` is lost and the ESM imports break).

## Expected Behavior

- `make shared-test`, `shared-lint`, `shared-check` etc. run `shared/` in the dev container, like `cli-*`.
- Every pushed branch runs `shared` (install, lint, specs with coverage, non-blocking audit) and `shared-node-floor` (install, specs on Node 22.13.0) in the `test` workflow.
- Codacy shows merged coverage for `core/` and `shared/` for each commit.
- The packaging spec fails if `shared/lib/` or `shared/package.json` drops out of `build_release_zip.sh --list`, or if `shared/eslint.config.mjs` starts shipping.

## Solution

### Dev container — `core/docker-compose.yml`

- Add a `shared` service mirroring `cli`: same `core/Dockerfile` `test` target, whole repo bind-mounted at `/home/node/app`, its own `shared_node_modules` volume on `/home/node/app/shared/node_modules`, `working_dir: /home/node/app/shared`, command `yarn install --frozen-lockfile && yarn test`.
- Declare the `shared_node_modules` volume; update the header comment.

### Makefile (root)

- `SHARED_SERVICE := shared` and targets `shared-install`, `shared-lint`, `shared-test`, `shared-check` (lint then test), `shared-shell`, `shared-audit`, mirroring `cli-*`. No build target (`shared/` has no build step).
- Add them to `.PHONY`; update the header comment.

### CircleCI — `.circleci/config.yml`

- `shared` job on `darthjee/circleci_node:0.2.1`, `working_directory: ~/project/shared`, checkout at `~/project`: `yarn install --frozen-lockfile`, `yarn lint`, `yarn test` (c8, thresholds enforced, blocking), Codacy partial upload (below), `yarn audit || true`.
- `shared-node-floor` job on `cimg/node:22.13.0`: install and `yarn test` (no lint, no upload), like `cli-node-floor`.
- Both in the `test` workflow with the same `tags: ignore: /.*/` filters, no path filters.
- Update the header comments (the `cli` paragraph's "No Codacy coverage upload yet" stays true for cli).

### Codacy — partial uploads plus one final call

Modelled on `darthjee/majora`'s `.circleci/config.yml`:

- Core's `test` job switches from `report -r coverage/lcov.info` to `report --partial`; the `shared` job uploads `--partial` too.
- c8 writes `SF:` paths relative to each package (`lib/...`). Before uploading, rewrite them to repo-root paths (`core/lib/...`, `shared/lib/...`), e.g. `sed -i -E 's#^SF:(.*/(core|shared)/)?lib/#SF:<pkg>/lib/#' coverage/lcov.info`, adapted per job. Verify the mapping against a real lcov file.
- New `coverage-final` job (`darthjee/circleci_node:0.2.1`, no checkout) running `bash <(curl -Ls https://coverage.codacy.com/get.sh) final`, with `requires: [test, shared]`, same filters.
- Everything stays non-blocking (`|| true` on the uploads and on `final`). Known limitation: if `test` or `shared` fails, CircleCI skips `coverage-final`, so that commit's coverage is never finalized. Acceptable because coverage is informational.

### `.codacy.yml`

Mirror core's entries for `shared/`, each with its rationale comment extended:

- PMD `exclude_paths`: add `shared/**/*.js` (the copied code hits the same "unnecessary block" false positives).
- Global `exclude_paths`: add `shared/yarn.lock` and `shared/spec/support/**`.

### Packaging spec — `core/spec/release/buildReleaseZipList_spec.js`

- Add `shared/lib/` coverage: at least one `shared/lib/...` path listed (e.g. assert some path starts with `shared/lib/`, plus a concrete file such as `shared/lib/config/keys.json`).
- Add `shared/package.json` to `RUNTIME_FILES`.
- Add `shared/eslint.config.mjs` to `DEV_ONLY_FILES`.
- No change to `.dockerignore` or `EXCLUDES`: both already ship `shared/lib/` and `shared/package.json` and drop `shared/spec/` and `shared/eslint.config.mjs` (#817, #821). Only verify.

### `shared/README.md`

Point the "run it" section at `make shared-test` / `make shared-check` (host `yarn` stays as an alternative).

### Out of scope

- Codacy upload for `cli/` and JSCPD for `shared/` (#833).
- Switching `core/`/`cli/` to `shared/` and the runtime smoke check (#824).
- Architecture-doc updates (#826).

### Owner

`infra`, for all of it — including the `core/spec` packaging spec and the `shared/README.md` line, per the spec's ownership table. (Ownership may be reorganized later.)

### Testing

- `make shared-check`, `make core-test` (packaging spec), `make cli-test` unaffected.
- CircleCI on the PR: `shared`, `shared-node-floor`, `test`, `coverage-final` all green; Codacy shows `core/` and `shared/` files with coverage under their repo paths.

## Benefits

- `shared/` is gated in CI, including on the CLI's Node floor, before anything depends on it in #824.
- One local workflow (`make shared-*`) for every package.
- Codacy coverage covers both packages instead of the last upload winning.
- The packaging spec catches a future `EXCLUDES` change that would silently drop `shared/` from installs.
