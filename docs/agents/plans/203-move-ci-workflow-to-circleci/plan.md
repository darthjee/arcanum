# Plan: Move CI workflow to circleci

Issue: [203-move-ci-workflow-to-circleci.md](../../issues/203-move-ci-workflow-to-circleci.md)

## Overview

Add a second, branch-triggered workflow to the already-live `.circleci/config.yml` that runs `core/`'s tests and checks (mirroring `.github/workflows/core-ci.yml`'s two jobs), then delete `core-ci.yml` in the same change — a clean cutover onto a single CI provider, with the existing tag-triggered `release` workflow left untouched.

## Context

`core/`'s CI currently runs on GitHub Actions: a `coverage` job (`make core-test` + Codacy upload) and a `checks` job (`make core-lint`, `make core-report`, `make core-audit`), triggered on PRs/pushes touching `core/**`. This repo's `release` workflow already runs on CircleCI (tag-triggered, publishing the release zip). The issue consolidates both onto CircleCI. No specialist agent owns `.circleci/config.yml` or `.github/workflows/` per `docs/agents/folder-structure.md` (neither `infra`'s Docker/Makefile/compose scope nor `node`'s `core/` source scope covers them), and this change doesn't touch `core/Dockerfile`, `core/docker-compose.yml`, the Makefile, or any file under `core/` itself — so this is a single, cross-cutting root-level change with no agent split.

## Implementation Steps

### Step 1 — Verify the base image's Node version

Confirm `darthjee/circleci_node`'s current published tag ships Node `>=22.13.0` (per `core/package.json`'s `engines.node`). If it doesn't, that image needs bumping/rebuilding first (outside this repo) before the job can be wired in — flag this as a hard prerequisite, not something to route around locally.

### Step 2 — Add the `test` workflow to `.circleci/config.yml`

Extend the existing `.circleci/config.yml` (do not touch the `release` workflow or the `build-and-release` job) with:

- A new `test` job: `docker: darthjee/circleci_node:<verified-tag>` → `checkout` → `working_directory: ~/project/core` → `yarn install --frozen-lockfile` → `yarn test` → upload coverage to Codacy via `bash <(curl -Ls https://coverage.codacy.com/get.sh) report -r coverage/lcov.info || true` (non-blocking, no `--partial`/finalize split — single coverage source).
- A new `checks` job: same image/working directory → `yarn install --frozen-lockfile` → `yarn lint` → `yarn duplication || true` (non-blocking) → `yarn audit || true` (non-blocking).
- A new `workflows.test` entry (distinct from the existing `workflows.release`) running both jobs, filtered on branches (no tag filter, so it doesn't cross-trigger with the tag-only `release` workflow), and with no path restriction (always runs — no CircleCI equivalent to GH Actions' `paths: ["core/**"]`, and every sibling repo's CircleCI config skips path-filtering too).

### Step 3 — Delete the GitHub Actions workflow

Remove `.github/workflows/core-ci.yml` entirely, in the same commit/PR as Step 2 — immediate cutover, no parallel trial period (no branch protection rule depends on it; solo-maintained repo; no forked-PR contributors).

### Step 4 — Confirm the Codacy CircleCI env var

Verify `CODACY_PROJECT_TOKEN` exists as a **CircleCI project env var** (separate store from the existing GH Actions secret of the same name) so the coverage-upload step actually reports instead of silently no-oping. If it's missing, add it under the CircleCI project settings — this is a manual, external step, not a repo file change, but must not be skipped or the upload stays a permanent (harmless but pointless) no-op.

### Step 5 — Validate on the PR itself

Push the branch and watch the new `test`/`checks` jobs actually run and pass on CircleCI for this PR — that's the verification for this change; no separate test suite applies to a CI-config edit. Also confirm the existing `release` workflow's config is unaffected (visually diff `.circleci/config.yml` to be sure `build-and-release`/`release` are untouched).

## Files to Change

- `.circleci/config.yml` — add the `test`/`checks` jobs and the `test` workflow, alongside the existing `build-and-release` job and `release` workflow.
- `.github/workflows/core-ci.yml` — delete.

## CI Checks

- `core/`: `yarn test` (CI job: `test`, formerly GH Actions' `coverage` job running `make core-test`)
- `core/`: `yarn lint` (CI job: `checks`, formerly GH Actions' `checks` job running `make core-lint`)
- `core/`: `yarn duplication` (CI job: `checks`, non-blocking, formerly `make core-report`)
- `core/`: `yarn audit` (CI job: `checks`, non-blocking, formerly `make core-audit`)

## Notes

- The `darthjee/circleci_node` base image is reused as-is; publishing a `circleci_core-base`-style sibling of `darthjee/node` for tighter CI/local-runtime parity is explicitly out of scope (deferred to its own future issue if drift ever becomes a real problem).
- CircleCI's `run` step has no `continue-on-error` equivalent — the non-blocking steps rely on an explicit `|| true`, which also means a genuinely broken `yarn duplication`/`yarn audit`/coverage-upload command would fail silently rather than showing red. Worth a quick manual check after landing that these steps are actually executing (not erroring out immediately) rather than trivially "passing" via `|| true` while doing nothing.
- Step 1's version check is a real blocker: if `darthjee/circleci_node` doesn't meet `core/`'s Node requirement, this plan's Step 2 can't proceed as written until that's resolved externally.
