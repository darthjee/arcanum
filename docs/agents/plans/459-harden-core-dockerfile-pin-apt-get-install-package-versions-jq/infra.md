# infra Plan: Harden core/Dockerfile: pin apt-get install package versions (jq)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Pin the `jq` package version and document how to refresh it

In `core/Dockerfile`, change the `apt-get install -y --no-install-recommends jq` line to pin an explicit version: `jq=1.6-2.1+deb12u2` (the current candidate for the `darthjee/node:0.2.1` base image, which is Debian 12/bookworm — confirmed via `apt-cache policy jq` run inside that image). Add a short comment above the `RUN` line explaining how to look up/refresh this pin in the future, e.g.:

```
docker run --rm darthjee/node:0.2.1 sh -c "apt-get update -qq && apt-cache policy jq"
```

No `--allow-downgrades` or similar flag is needed — this is a fresh `apt-get update` in the same `RUN` layer with no prior `jq` install to conflict with. Leave the existing `rm -rf /var/lib/apt/lists/*` cleanup as-is.

## Files to Change

- `core/Dockerfile` — pin the `jq` install to `jq=1.6-2.1+deb12u2` and add a comment documenting how to determine/update the pinned version.

## Notes

- CI does not exercise this Dockerfile at all: `.circleci/config.yml`'s `test`/`checks` jobs run directly inside `darthjee/circleci_node:0.2.1` via a plain `checkout`, bypassing `core/Dockerfile`/`docker-compose` entirely. Verification that the image still builds is therefore manual, not automated — run `make core-test` (or `docker compose -f core/docker-compose.yml build`) locally after the change.
- `docs/agents/architecture/script-engine.md` does not reference the `jq` install step or its version, so no documentation changes are needed there — this was confirmed during issue discussion (see the issue file).
- If the pinned version ever needs bumping (e.g. a security patch release), the Dockerfile comment added in Step 1 documents the process for finding the new candidate version.
