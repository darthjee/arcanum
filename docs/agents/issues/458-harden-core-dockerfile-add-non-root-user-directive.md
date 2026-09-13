# Issue: Harden core/Dockerfile: add non-root USER directive

## Description
`core/Dockerfile` builds and runs its image entirely as `root` — there is no `USER` directive, so every `RUN` step after the base image and the final `CMD` (`yarn install --frozen-lockfile && yarn test`) execute with root privileges inside the container.

This image is not just a throwaway test image: per `docs/agents/architecture/script-engine.md`, it also doubles as the base for the `engine.mode=docker` execution path, meaning containers built from it may run in more security-sensitive contexts than a local test run.

Investigation confirmed the base image `darthjee/node:0.2.1` already ships a non-root `node` user (uid 1000/gid 1000, home `/home/node`), and `/home/node/app` inside the image is already owned `node:root` — but the image's default effective user is still `root` (no `USER` directive of its own). So a `USER node` (or `USER 1000:1000`) directive is exactly what's missing.

## Problem
Running as root unnecessarily widens the blast radius if a dependency (Yarn packages, `jq`, or the base `darthjee/node` image itself) is ever compromised, and it violates the common container-hardening practice of dropping root privileges before running application code.

Switching to non-root is not a drop-in change, though: investigation found two concrete permission risks against the mounts `yarn install` writes to at container start:
- The `core_node_modules` named volume (mounted at `/home/node/app/core/node_modules`) is created owned `root:root` by default, since that path does not already exist inside the image (`core/` is bind-mounted, not baked in) — writing to it as uid 1000 fails with a permission error, confirmed by direct testing. A companion issue has been filed upstream against the base image ([darthjee/docker#146](https://github.com/darthjee/docker/issues/146)) to make this friendlier by default for future consumers; this issue works around it locally in the meantime.
- The bind-mounted repo root (`../:/home/node/app`) inherits host-side UID ownership on Linux (e.g. CircleCI's native Docker executor, which this repo's CI uses). If the CI checkout is owned by a UID other than 1000, writes under `/home/node/app` (e.g. `node_modules`, cache dirs, the lockfile) would hit `EACCES` there — even though this did not reproduce in local macOS/Docker Desktop testing, which does not enforce strict UID matching on bind mounts.

## Expected Behavior
The container should run its `CMD` (and any other steps that do not require root) as a non-root user (reusing the base image's built-in `node` user). Package installation (`apt-get install jq`) still runs as root, since that step requires root privileges — the `USER` switch happens after it, not before.

`yarn install --frozen-lockfile && yarn test` continues to succeed as the non-root user, with no permission errors, both locally and in CI, against:
- the bind-mounted repo root (`../:/home/node/app` in `core/docker-compose.yml`)
- the `core_node_modules` named volume (`core_node_modules:/home/node/app/core/node_modules`)

## Solution
- Add an entrypoint step to `core/Dockerfile` that starts as root, `chown`s/fixes ownership of `core_node_modules` (and any other mount points that need it) to the `node` user, then drops privileges (e.g. via `gosu`/`su-exec` or `su`) to run the original `CMD` as `node` — reusing the base image's existing non-root `node` user (uid 1000/gid 1000) rather than creating a new one.
- Verify the bind-mounted repo root stays writable as uid 1000 in CI (CircleCI's Docker executor on Linux), not just locally on macOS/Docker Desktop; adjust the CI checkout/workflow if a UID mismatch surfaces there.
- Re-run the container (`make core-test` / `core-check` etc.) both locally and in CI to confirm `yarn install --frozen-lockfile && yarn test` still succeeds as the non-root user, with no permission errors.
- Update `docs/agents/architecture/script-engine.md` (or other relevant docs) if the non-root switch changes any assumption documented there about the `engine.mode=docker` execution path.

## Benefits
Reduces the blast radius of a compromised dependency or base image by following the standard container-hardening practice of not running application code as root.
