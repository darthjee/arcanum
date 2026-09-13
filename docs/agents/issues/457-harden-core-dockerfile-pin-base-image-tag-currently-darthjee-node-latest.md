# Issue: Harden core/Dockerfile: pin base image tag (currently darthjee/node:latest)

## Description

`core/Dockerfile` builds the test image for the `core/` Node.js package and, per the comment at the top of the file, later doubles as the base for the `engine.mode=docker` execution path described in `docs/agents/architecture/script-engine.md`. Its `FROM` line currently references `darthjee/node:latest`, a floating tag.

## Problem

Floating tags like `latest` are not reproducible: the image resolved by a given build can change silently over time whenever a new `latest` is pushed upstream, with no corresponding change in this repository's history. This can cause builds to break unexpectedly (e.g. a Node.js version bump upstream), makes it hard to reason about what actually ran in CI or in a given `engine.mode=docker` execution, and prevents pinning/rolling back to a known-good image deterministically.

## Expected Behavior

- `core/Dockerfile`'s `FROM` line no longer references `darthjee/node:latest`; it references a specific, immutable version tag (currently `darthjee/node:0.2.1`).
- The core test image (`core/docker-compose.yml` / relevant `make core-*` targets) still builds and runs `yarn test` successfully with the pinned base image.
- Any documentation referencing the base image tag (e.g. `docs/agents/architecture/script-engine.md`) is updated to match the pinned reference.

## Solution

- Replace `FROM darthjee/node:latest` in `core/Dockerfile` with `FROM darthjee/node:0.2.1` (the current release tag; no digest pinning).
- Update `docs/agents/architecture/script-engine.md` (and any other documentation referencing the base image) to reflect the pinned tag, and note that this pin is expected to be bumped deliberately going forward rather than tracking `latest`.
- Keep the pin up to date via manual bumps only — no Renovate/Dependabot automation is being introduced by this issue (there is none configured in this repo yet).

## Benefits

- Reproducible builds: the resolved base image no longer changes silently over time.
- Easier debugging: what ran in CI or in a given `engine.mode=docker` execution is knowable and stable.
- Ability to pin/roll back to a known-good image deterministically.
