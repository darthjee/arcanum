# Infra Plan: Wire up CI and Codacy for the core/ Node package

Main plan: [plan.md](plan.md)

## Overview

This repo has no `.github/workflows/` directory yet. `core/`'s test/lint suite already runs inside a Docker image via the root `Makefile`'s `core-test`/`core-lint` targets (`core/docker-compose.yml`, based on `darthjee/node`, source bind-mounted) — see `docs/agents/architecture/script-engine.md`'s "Docker test image" section. The new CI jobs reuse that same Docker-based pattern rather than running Yarn directly on the bare Actions runner, so CI behaves identically to what a contributor runs locally.

## Context

- `core/package.json` scripts: `test` (`c8 jasmine`, produces `core/coverage/lcov.info` per its `c8` config — reporters `text` + `lcov`), `lint` (ESLint via `core/eslint.config.mjs`), `duplication` (JSCPD via `core/.jscpd.json`). `yarn audit` is a built-in Yarn command, not a package.json script.
- Current `Makefile` targets (all `docker compose -f core/docker-compose.yml run --rm core sh -c "yarn install --frozen-lockfile && yarn <script>"`): `core-test`, `core-lint`, `core-check` (lint + test), `core-shell`. No target yet for duplication or audit.
- No `CODACY_PROJECT_TOKEN` (or equivalent) secret exists in the repo yet (`gh secret list` returns empty) — this is a manual follow-up for the repo owner, not something this plan's CI config alone can satisfy.

## Implementation Steps

### Step 1 — Add `core-report` and `core-audit` Makefile targets

Mirror the existing `core-test`/`core-lint` pattern:

```make
core-report:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn duplication"

core-audit:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn audit"
```

Add both to the existing `.PHONY` line.

### Step 2 — Add `.github/workflows/core-ci.yml`

Trigger on `pull_request` (and `push` to `main`, matching how the rest of the repo likely gates merges — confirm against any existing branch protection expectations) with a `paths: ["core/**"]` filter, per the issue's requirement that unrelated skill-only PRs are unaffected.

- **`coverage` job**: checkout, then `make core-test` (builds/reuses the Docker image, runs `yarn install` + `yarn test`, produces `core/coverage/lcov.info`). Upload the lcov report to Codacy (e.g. `codacy/codacy-coverage-reporter-action`), reading the project token from a `CODACY_PROJECT_TOKEN` repo secret.
- **`checks` job**: checkout, then `make core-lint` as a blocking step (job fails the run on any ESLint error). Then `make core-report` and `make core-audit` as non-blocking steps (`continue-on-error: true` on those two steps only — `core-lint` stays blocking).

### Step 3 — Document the manual Codacy setup

In the PR description (not in workflow code), note that the repo owner still needs to:
1. Create/connect the Codacy project for this repo.
2. Add `CODACY_PROJECT_TOKEN` as a GitHub Actions repo secret.

Until that secret exists, the `coverage` job's Codacy upload step will fail even though the underlying test run passed — call this out explicitly so it isn't mistaken for a broken workflow.

## Files to Change

- `Makefile` — add `core-report` and `core-audit` targets (and update `.PHONY`).
- `.github/workflows/core-ci.yml` — new file: `coverage` and `checks` jobs, `core/**` path filter.

## CI Checks

- `core/`: `make core-test` (CI job: `coverage`)
- `core/`: `make core-lint` (CI job: `checks`, blocking)
- `core/`: `make core-report`, `make core-audit` (CI job: `checks`, non-blocking)

## Notes

- Confirm whether Codacy's own static analysis picks up ESLint results automatically (via its GitHub App / `.codacy.yml`) or needs an explicit upload step from this workflow — verify against Codacy's actual current product behavior while implementing, since the issue only requires "ESLint results surfaced to Codacy" without pinning the mechanism.
- The `coverage` job's Codacy upload step will fail until the repo owner adds `CODACY_PROJECT_TOKEN` (see Step 3) — this is expected and does not indicate a bug in the workflow itself.
- No changes needed to `core/package.json` — `test`, `lint`, and `duplication` scripts already exist and match what the new Makefile targets and CI jobs call.
