# Harden core/Dockerfile: pin base image tag (currently darthjee/node:latest)

## Context

`core/Dockerfile` builds the test image for the `core/` Node.js package, and
(per the comment at the top of the file) this same image later doubles as
the base for the `engine.mode=docker` execution path described in
`docs/agents/architecture/script-engine.md`. Its `FROM` line currently
references `darthjee/node:latest`:

```dockerfile
FROM darthjee/node:latest
```

Floating tags like `latest` are not reproducible: the image resolved by a
given build can change silently over time whenever a new `latest` is
pushed upstream, with no corresponding change in this repository's history.
This can cause builds to break unexpectedly (e.g. a Node.js version bump
upstream), makes it hard to reason about what actually ran in CI or in a
given `engine.mode=docker` execution, and prevents pinning/rolling back to
a known-good image deterministically.

## What needs to be done

- Docker: replace `FROM darthjee/node:latest` in `core/Dockerfile` with a
  pinned, immutable reference — either a specific version tag (e.g.
  `darthjee/node:<version>`) or, preferably, a tag pinned by digest
  (`darthjee/node:<tag>@sha256:<digest>`) for maximum reproducibility.
- Docs: if `docs/agents/architecture/script-engine.md` or any other
  documentation references the base image, update it to reflect the pinned
  tag/digest and note the expectation that this pin is bumped deliberately
  going forward rather than tracking `latest`.
- Consider (if not already covered elsewhere) how the pin will be kept up
  to date over time (e.g. a periodic manual bump, or a Dependabot/Renovate
  rule for Docker base images), so hardening the pin doesn't turn into
  permanent staleness.

## Acceptance criteria

- [ ] `core/Dockerfile`'s `FROM` line no longer references `darthjee/node:latest`; it references a specific, immutable tag or a tag pinned by digest.
- [ ] The core test image (`core/docker-compose.yml` / relevant `make core-*` targets) still builds and runs `yarn test` successfully with the pinned base image.
- [ ] Any documentation referencing the base image tag (e.g. `docs/agents/architecture/script-engine.md`) is updated to match the pinned reference.
