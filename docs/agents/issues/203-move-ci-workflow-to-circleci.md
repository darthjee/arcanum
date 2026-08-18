# Issue: Move CI workflow to circleci

## Description

`core/`'s tests currently run on GitHub Actions (`.github/workflows/core-ci.yml`): `make core-test` (coverage), `make core-lint`, `make core-report` (duplication), `make core-audit`, plus a Codacy coverage upload. This repo's `release` workflow already runs on CircleCI (`.circleci/config.yml`, tag-triggered, publishing the release zip to GitHub Releases). This issue moves `core/`'s test CI from GitHub Actions to CircleCI, consolidating both onto the same provider.

## Problem

CI for this repo is currently split across two providers: `release` on CircleCI, tests on GitHub Actions. That means two separate secret/env-var stores to keep in sync (e.g. `CODACY_PROJECT_TOKEN` exists as a GH Actions secret but not as a CircleCI project env var), two dashboards to check, and a CI setup that diverges from the convention already established across this maintainer's other repos (tent, majora, oak, navi), all of which run their tests on CircleCI.

## Expected Behavior

- `.circleci/config.yml` gains a second workflow (alongside the existing tag-triggered `release` workflow) with two jobs for `core/`: `test` and `checks`, triggered on branch pushes/PRs.
- `.github/workflows/core-ci.yml` is deleted in the same PR — a clean, immediate cutover, not a parallel trial period.
- Coverage still reaches Codacy, lint/duplication/audit checks still run, with the same non-blocking (informational-only) behavior GH Actions has today for `core-report`, `core-audit`, and the coverage upload.
- The existing `release` workflow keeps working unmodified.

## Solution

**Base Docker image.** Reuse `darthjee/circleci_node:0.2.1` (or its current tag) as the docker executor image — the same generic Node base already used for pure-JS jobs across tent, majora, oak, and navi's CircleCI configs. No new image needs to be built or published for this issue. Verify it satisfies `core/package.json`'s `engines.node: >=22.13.0` before wiring the job; bump/rebuild the image first if it doesn't. Explicitly deferred: publishing a `circleci_core-base`-style sibling of `darthjee/node` for tighter parity between the CI image and the `darthjee/node`-based image `core/Dockerfile` already uses locally (see `docs/agents/architecture/script-engine.md`) — worth its own follow-up issue if CI/local drift ever becomes a real problem.

**Job breakdown.** Two jobs, mirroring GH Actions' existing two-job shape rather than the tent/majora/oak/navi `test`/`checks`/`coverage-final` three-job split — that split exists there to merge coverage from *multiple* coverage-producing jobs (backend + frontend + dev variants), which `core/` doesn't need since it's a single Node package with one test suite:
- **`test`** (renamed from GH Actions' `coverage`, to match every sample repo's naming convention): checkout → `cd core` → `yarn install --frozen-lockfile` → `yarn test` → upload coverage to Codacy in one shot.
- **`checks`**: checkout → `cd core` → `yarn install --frozen-lockfile` → `yarn lint` → `yarn duplication` (non-blocking) → `yarn audit` (non-blocking).

**Coverage reporting.** `codacy/codacy-coverage-reporter-action@v1` is GitHub-Actions-specific and has no CircleCI equivalent. Switch to the shell-based reporter every sample repo already uses: `bash <(curl -Ls https://coverage.codacy.com/get.sh) report -r coverage/lcov.info` (path relative to `core/`), run from the `test` job right after `yarn test`. No `--partial`/finalize split needed — a single coverage source needs neither. Non-blocking (`|| true`), until (and even after) `CODACY_PROJECT_TOKEN` is confirmed as a CircleCI project env var.

**Backward compatibility.** `.circleci/config.yml` already exists and is live (the `release` workflow, `build-and-release` job, `cimg/base:stable`, tag-triggered, using the project's existing `GH_TOKEN` env var). The CircleCI project is therefore already connected — no new project-setup step is needed. The new job(s) go into a **second workflow** in the same file; job/workflow names must not collide with `build-and-release`/`release`, and filters must not cross-trigger (`release` only fires on tag pushes; the new `test` workflow triggers on branches and must not also refire on tags).

**Trigger scope.** GH Actions' `on.pull_request.paths: ["core/**"]` restriction has no CircleCI equivalent. Decided to drop it and always run the job, trading a small amount of extra CI time for a much simpler config — consistent with every sample repo reviewed (none of them path-filter).

**Edge cases.**
- *Non-blocking step parity*: `core-report`, `core-audit`, and the Codacy coverage upload are all `continue-on-error: true` in GH Actions; CircleCI's `run` step has no equivalent flag, so each needs an explicit `|| true`.
- *Monorepo working directory*: `core/` is a subfolder, not the repo root — the job needs an explicit `working_directory: ~/project/core` (or `cd core` per step) before any `yarn` command.
- *Codacy token is a separate secret store*: must be added to CircleCI project env vars independently of the existing GH Actions secret.
- *Fork PRs*: not a concern — all contributions go through branches on `darthjee/arcanum` directly, not forks.

**GH Actions workflow's fate.** `.github/workflows/core-ci.yml` is deleted in the same PR that adds the CircleCI job. Low risk: no branch protection rule depends on it, the repo is solo-maintained, and there are no forked-PR contributors to disrupt.

**Other concerns, settled by implication:**
- *Testing strategy*: verified by watching the new CircleCI job actually run and pass on the PR that introduces it.
- *Performance & security*: nothing beyond the Codacy-token/fork-PR points above.
- *Migration needed?*: no — doesn't touch anything a repo that installed arcanum needs to catch up on.
- *Script-driven interaction?*: n/a — not a skill with an interactive flow.

## Benefits

- Single CI provider for the whole repo, matching the convention already used across tent, majora, oak, and navi.
- One secret/env-var store to maintain instead of two.
- Simpler mental model for contributors: one CI dashboard, one config file.
