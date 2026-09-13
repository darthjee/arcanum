# Infra Plan: Harden core/Dockerfile: pin base image tag (currently darthjee/node:latest)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Pin the base image tag in core/Dockerfile
Change `core/Dockerfile`'s `FROM darthjee/node:latest` to `FROM darthjee/node:0.2.1` — the current release tag on Docker Hub (`latest` currently resolves to the same digest as `0.2.1`). No digest pinning (`@sha256:...`) is used, per the issue's resolved scope; a plain version tag is enough as long as it's bumped deliberately rather than tracking `latest`. Note that CircleCI's own job image, `darthjee/circleci_node:0.2.1` (`.circleci/config.yml`), already follows this same pinned-tag convention, so this keeps the two images consistent.

### Step 2 — Update documentation referencing the base image
`docs/agents/architecture/script-engine.md` (around the "A Docker image based on `darthjee/node`" paragraph) currently doesn't name a specific tag, so no wording there strictly goes stale — but add a short note that the base image is pinned to a specific version (not `latest`) and is expected to be bumped deliberately, with the current pin kept in sync with `core/Dockerfile`. Grep for any other reference to `darthjee/node` under `docs/` before finishing, in case another doc also needs the update.

## Files to Change
- `core/Dockerfile` — pin `FROM` to `darthjee/node:0.2.1` instead of `darthjee/node:latest`.
- `docs/agents/architecture/script-engine.md` — note the pinned base image and the "bump deliberately" expectation.

## CI Checks
- `core/`: `make core-check` (runs `core-lint` + `core-test`, which builds the `core/docker-compose.yml` image from `core/Dockerfile` and runs `yarn test` inside it) — no dedicated CircleCI job builds `core/Dockerfile` itself (the `test`/`checks` CircleCI jobs run directly on `darthjee/circleci_node:0.2.1`, a separate image), so `make core-check` is the local check that actually exercises this Dockerfile change end to end.

## Notes
- Docker Hub currently lists `darthjee/node:0.2.1` and `darthjee/node:latest` as the same digest (`sha256:8abb8935...9311`); `darthjee/node:0.2.0` is the prior release. If `latest` has moved on by the time this is implemented, re-check that `0.2.1` is still the intended pin (or bump to whatever the current release tag is) before committing.
- No Renovate/Dependabot config exists in this repo; this issue deliberately does not add one — future bumps are manual, per the discuss-issue dialogue.
