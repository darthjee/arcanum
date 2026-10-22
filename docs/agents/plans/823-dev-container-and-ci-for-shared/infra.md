# Infra Plan: Dev container and CI for shared/

Main plan: [plan.md](plan.md)

## Overview

`shared/` (merged in #822) has no dev container, Makefile targets, CI jobs or coverage upload. This plan adds them, mirroring the existing `cli`/`cli-*`/`cli-node-floor` setup, switches Codacy to partial uploads with one final call (modelled on `darthjee/majora`'s `.circleci/config.yml`), and extends the release packaging spec. `infra` owns every file here, including the `core/spec` packaging spec and the `shared/README.md` line, per the spec's ownership table.

## Context

- `shared/package.json`: `test` = `c8 jasmine` (lcov + text reporters, coverage enforced), `lint` = `eslint .`, `engines.node >=22.13.0`, no build step.
- `core/docker-compose.yml` already has `core` and `cli` services; `cli` mounts the whole repo and gives `cli/node_modules` its own volume.
- `.circleci/config.yml`: `test` (core specs + Codacy full upload), `checks`, `mod-checks`, `cli`, `cli-node-floor` in the `test` workflow, all with `tags: ignore: /.*/`.
- `.dockerignore` and `scripts/build_release_zip.sh` `EXCLUDES` already ship `shared/lib/` and `shared/package.json` and drop `shared/spec/` and `shared/eslint.config.mjs` (#817, #821) — no change, only verify and guard.
- Spec: [shared-lib.md — Tooling and CI](../../specs/shared-lib.md#tooling-and-ci).

## Steps

- [01 — Compose service, Makefile targets, README](infra/01-compose-makefile-readme.md)
- [02 — CircleCI shared and shared-node-floor jobs](infra/02-circleci-jobs.md)
- [03 — Codacy partial uploads and coverage-final](infra/03-codacy-coverage.md)
- [04 — .codacy.yml entries for shared/](infra/04-codacy-yml.md)
- [05 — Packaging spec](infra/05-packaging-spec.md)

## CI Checks

- `shared/`: `make shared-check` (CI jobs: `shared`, `shared-node-floor`)
- `core/`: `make core-test` for the packaging spec (CI job: `test`), `make core-lint` (CI job: `checks`)
- `cli/`: `make cli-test` — unaffected, sanity only (CI jobs: `cli`, `cli-node-floor`)
- CircleCI YAML: `circleci config validate .circleci/config.yml` if the CLI is available; otherwise rely on the PR pipeline.

## Notes

- Codacy can only be verified on the PR pipeline: check that `coverage-final` runs after `test` and `shared` and that Codacy lists files under `core/lib/...` and `shared/lib/...`.
- Known limitation (accepted in the issue): if `test` or `shared` fails, `coverage-final` is skipped and that commit's coverage is never finalized.
- `shared`'s `Lock_spec` uses git fixtures; both `darthjee/circleci_node:0.2.1` and `cimg/node:22.13.0` ship git.
- Out of scope: cli Codacy upload, JSCPD for `shared/` (#833), switching consumers (#824), architecture docs (#826).
