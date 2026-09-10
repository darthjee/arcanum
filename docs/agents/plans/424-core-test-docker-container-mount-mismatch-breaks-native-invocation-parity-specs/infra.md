# Plan: core-test Docker container mount mismatch breaks native-invocation/parity specs

Issue: [424-core-test-docker-container-mount-mismatch-breaks-native-invocation-parity-specs.md](../../issues/424-core-test-docker-container-mount-mismatch-breaks-native-invocation-parity-specs.md)

## Overview

`core/docker-compose.yml` currently bind-mounts only `core/` (build `context: .`, volume `.:/home/node/app`) into the test container. `core/lib/utils/file/InstallRoot.js` resolves the arcanum install root by walking up 4 parent directories from its own location — a walk that assumes the full monorepo root is present on disk at the same relative depth as a local checkout. Under the current mount, that walk lands on `/home/node` instead of the actual repo root, so any spec shelling out to `core/bin/arcanum` or `arcanum/_lib/*.sh` fails with `ENOENT` inside Docker even though it passes locally via `yarn test`.

The fix is to mount the full monorepo root into the container instead of just `core/`, and adjust `working_dir` (and the node_modules cache volume path) so `yarn install`/`yarn test` keep running from `core/` as before. With the full repo present at the same relative layout as a local checkout, `InstallRoot.js`'s existing path-resolution code works unchanged.

## Context

- `core/docker-compose.yml` is invoked via the root `Makefile`'s `core-test`, `core-lint`, `core-check`, `core-shell`, `core-report`, and `core-audit` targets — all run through the same `core` service, so this fix applies uniformly to all of them.
- `core/Dockerfile` does not `COPY` any source in (source is bind-mounted, not baked in), so its build `context` does not need to change.
- Found while implementing #420: `make core-test` failed with 183 failures under Docker, while the equivalent `yarn test` run locally (outside Docker) passed cleanly — 845 specs, 0 failures, 100% coverage — isolating the failures to this mount/path mismatch rather than any code regression.
- No current CI workflow exercises `make core-test` via Docker, so this mismatch isn't caught automatically today (out of scope for this fix — see the issue's "Impact" note).

## Implementation Steps

### Step 1 — Mount the full monorepo root in `core/docker-compose.yml`

Change the `core` service's bind mount from mounting only `core/` to mounting the monorepo root (the directory containing `core/`, `arcanum/`, and the other skill folders), and update `working_dir` and the node_modules cache volume to match the new path so `yarn install --frozen-lockfile && yarn test` still runs from inside `core/`:

- `volumes`: change `.:/home/node/app` to mount the parent directory (`..` relative to `core/docker-compose.yml`) at `/home/node/app`, e.g. `../:/home/node/app`.
- `working_dir`: change from `/home/node/app` to `/home/node/app/core`.
- `core_node_modules` cache volume: change its container-side target from `/home/node/app/node_modules` to `/home/node/app/core/node_modules`, so the cache still lands on `core/`'s own `node_modules`, not the mounted repo root's.
- `command` (`sh -c "yarn install --frozen-lockfile && yarn test"`) needs no change — it already runs relative to `working_dir`.

### Step 2 — Verify parity specs pass under Docker

Run `make core-test` and confirm it now passes the same way the local `yarn test` run does (845 specs, 0 failures, 100% coverage per the issue's "How it was found" section), with the previously-failing native-invocation/parity specs (`githubIssueCreateParity`, `autoFixAllQueueParity`, `autoFixAllGithubParity`, `spawn-issue` parity, etc.) now succeeding because `InstallRoot.js` resolves the correct repo root inside the container. Also spot-check `make core-lint` and `make core-shell` still work against the new mount/working_dir.

## Files to Change

- `core/docker-compose.yml` — change the bind mount source, `working_dir`, and the `core_node_modules` volume target so the full monorepo root is mounted instead of just `core/`.

## Notes

- No `node`-owned changes (`core/lib/utils/file/InstallRoot.js` or elsewhere) are needed — its existing 4-levels-up resolution is correct once the full repo is mounted at the expected relative depth.
- This does not add CI coverage for `make core-test` under Docker (the issue notes no current CI workflow runs it) — that remains a separate concern if desired later.
