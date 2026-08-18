# Issue: Wire up CI and Codacy for the core/ Node package

## Description

The `core/` package (scaffolded in #190) has a working test/lint toolchain but nothing runs it in CI. This issue wires it up so PRs touching `core/` get the same pre-merge guarantees (tests, coverage, lint) the rest of the repo already expects, and surfaces coverage/lint results to Codacy.

## Context

Per #168's and #189's decisions (`docs/agents/architecture/script-engine.md`), two independent CI jobs should gate `core/` changes:
- `coverage`: installs deps and runs the test suite with coverage, uploading the resulting lcov report to Codacy.
- `checks`: runs lint (blocking on any ESLint error), plus a duplication report and `yarn audit` as non-blocking, informational steps — `yarn audit` catches transitive supply-chain risk in devDependencies even though `core/lib/` itself has zero runtime dependencies.

Both jobs should only run when `core/**` changes (path filter), to avoid slowing down unrelated skill-only PRs.

This repo has no `.github/workflows/` directory yet — this issue adds the first one. The test suite in `core/` already runs inside a Docker image (`core/docker-compose.yml`, based on `darthjee/node`) via the root `Makefile`'s `core-test`/`core-lint` targets, per the "Docker test image" section of `docs/agents/architecture/script-engine.md` and the compose file's own comment ("Invoked via the core-* Makefile targets ... not directly"). The new CI jobs will reuse those same Docker-based Makefile targets, consistent with how `core/` is documented to run today, rather than installing/running Yarn directly on the bare Actions runner — new Makefile targets are needed for the duplication report and `yarn audit`, which do not have `core-*` targets yet.

The actual scripts in `core/package.json` are `test` (runs `c8 jasmine`, producing `core/coverage/lcov.info` per its `c8` config), `lint` (ESLint), and `duplication` (JSCPD via `core/.jscpd.json`) — there is no `coverage` or `report` script.

No Codacy project token (e.g. `CODACY_PROJECT_TOKEN`) is currently configured as a repo secret (`gh secret list` is empty). This issue ships the CI workflow wired to expect that secret; actually creating the Codacy project and adding the secret is a manual follow-up for the repo owner, not a blocker for merging this issue's PR.

## Solution

- [ ] Add a `.github/workflows/` workflow with a `coverage` job that runs `make core-test` (Docker-based, per `core/docker-compose.yml`) and uploads `core/coverage/lcov.info` to Codacy.
- [ ] Add a `checks` job to the same workflow that runs `make core-lint` (blocking on failure), plus new Docker-based Makefile targets for the JSCPD duplication report and `yarn audit` as non-blocking/informational steps.
- [ ] Scope both jobs to trigger only on changes under `core/` (path filter), so unrelated skill-only PRs are unaffected.
- [ ] Add the Codacy coverage/lint upload steps to the workflow, reading the project token from a `CODACY_PROJECT_TOKEN` (or equivalent) repo secret — note in the PR description that the repo owner still needs to create the Codacy project and add that secret manually before uploads will succeed.

## Depends on

Resolved — #190 (the `core/` package scaffolding) has already merged.
