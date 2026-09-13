# Harden core/Dockerfile: pin apt-get install package versions (jq)

## Context

`core/Dockerfile` installs `jq` via `apt-get install -y --no-install-recommends jq` without pinning a specific package version. `jq` is a genuine runtime dependency used by shell scripts under `arcanum/_lib/` and `auto-fix-all/scripts/` (e.g. `repo_config.sh`), and it is also relied on by the `engine.mode=docker` execution path described in `docs/agents/architecture/script-engine.md`. Without a pinned version, rebuilding the image at a later date can silently pull in a different `jq` version than what was originally tested against, which can lead to non-reproducible builds and hard-to-diagnose behavior differences between environments (e.g. flag support, output formatting, or subtle parsing differences across `jq` releases).

## What needs to be done

- Docker: Pin the `jq` package to a specific, known-good version in the `apt-get install` line in `core/Dockerfile` (e.g. `jq=<version>`), so the resulting image is reproducible across rebuilds.
- Docker: Confirm the pinned version is compatible with the base image (`darthjee/node:latest`)'s package repository, and document how to determine/update the pinned version (e.g. via `apt-cache policy jq` inside the base image) so future bumps are straightforward.
- Docs: If `docs/agents/architecture/script-engine.md` or any other documentation references the `jq` installation step, update it to reflect the pinned version approach if relevant.

## Acceptance criteria

- [ ] `core/Dockerfile`'s `apt-get install` command for `jq` specifies an explicit, pinned package version.
- [ ] The image still builds successfully with the pinned version against the current base image.
- [ ] The rationale/process for updating the pinned version in the future is documented (e.g. as a comment in the Dockerfile or in relevant docs).
