# Harden core/Dockerfile: add non-root USER directive

## Context

`core/Dockerfile` currently builds and runs its image as `root` — there is no
`USER` directive, so every `RUN` step after the base image and the final
`CMD` execute with root privileges inside the container. This image is not
just a throwaway test image: per
`docs/agents/architecture/script-engine.md`, it also doubles as the base for
the `engine.mode=docker` execution path, meaning containers built from it may
run in more security-sensitive contexts than a local test run. Running as
root unnecessarily widens the blast radius if a dependency (Yarn packages,
`jq`, or the base `darthjee/node` image itself) is ever compromised, and it
violates the common container-hardening practice of dropping root privileges
before running application code.

## What needs to be done

- Add a `USER` directive to `core/Dockerfile` so the container runs as a
  non-root user for its `CMD` (and any other steps that don't require root).
- Keep the `apt-get install jq` step running as root, since installing
  packages requires root privileges — the `USER` switch must happen after
  that step, not before it.
- Confirm whether the `darthjee/node` base image already ships a
  non-root user (e.g. a `node` user, as many official Node.js images do) and
  reuse it if so; otherwise create one explicitly.
- Verify that `WORKDIR /home/node/app` and the bind-mounted `core/` directory
  (see `docker-compose.yml`) remain writable/readable by the non-root user,
  since dependency installation (`yarn install`) happens at container start
  against that mount.
- Re-run the container to confirm `yarn install --frozen-lockfile && yarn test`
  still succeeds as the non-root user, with no permission errors.
- Update `docs/agents/architecture/script-engine.md` (or other relevant
  docs) if the non-root switch changes any assumption documented there about
  the `engine.mode=docker` execution path.

## Acceptance criteria

- [ ] TODO
