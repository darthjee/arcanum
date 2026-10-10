# Infra Plan: Build the runtime Docker image for engine.mode=docker

Main plan: [plan.md](plan.md)

## Overview

Build the `runtime` image `engine.mode=docker` will run in, from the same `core/Dockerfile` as today's test image, without changing how the `core-*` targets behave. Dispatch, pull/build-on-demand and `docker-parity` are #729. Release-CI publishing is #737.

## Context

- Spec: `docs/agents/specs/docker/image.md` (strategy, runtime user, pins, versioning), `environment.md` (container infrastructure env, passwd-entry vars set by the entrypoint), `mounts.md` (file ownership).
- Decisions settled in #728: `nss_wrapper` for the passwd entry; `gh` from the release tarball with per-arch SHA-256 (via `TARGETARCH`); base image pinned by **tag only** (`darthjee/node:0.2.1` today); credential helper / `safe.directory` stay in dispatch env (#729), not the entrypoint.
- `core/lib/utils/file/InstallRoot.js` resolves the install root above `core/`; native commands need `arcanum/_lib/`, skill `scripts/` and `templates/`, so the runtime target copies the whole install layout to `/opt/arcanum`.
- `scripts/build_release_zip.sh` defines the shipped file set (excludes `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/` except `docs/guides/`, `.github/`, `ISSUE_TEMPLATE.md`, `.gitignore`, `scripts/`, `arcanum.version`). The build context must work from both a dev checkout and a zip install, so `core/Dockerfile` and `.dockerignore` themselves must ship in the zip (they do: neither is excluded).

## Steps

- [01 — Multi-stage Dockerfile with pinned base](infra/01-multi-stage-dockerfile.md)
- [02 — Runtime entrypoint with nss_wrapper](infra/02-runtime-entrypoint.md)
- [03 — Build context: .dockerignore and compose](infra/03-build-context.md)
- [04 — Makefile build and smoke-check targets](infra/04-makefile-targets.md)
- [05 — Record decisions in the spec and lint config](infra/05-docs-and-lint-config.md)

## CI Checks

- No CI job builds Docker images today (`.circleci/config.yml` runs `yarn test`/`yarn lint` directly in `darthjee/circleci_node`). Verify locally:
  - `make core-check` (test stage unchanged, CI jobs `test`/`checks` equivalents)
  - `make core-build-runtime && make core-smoke-runtime` (new)
- Codacy runs Hadolint on `core/Dockerfile`: keep every apt package pinned with `--no-install-recommends`, use `SHELL [\"/bin/bash\", \"-o\", \"pipefail\", \"-c\"]` where pipes are used.

## Notes

- Apt pin versions must be looked up against the base image's Debian release (bookworm for `darthjee/node:0.2.1`), the same way the existing `jq` comment explains; do it for both `amd64` and `arm64` if versions differ (they normally don't for Debian).
- `libnss-wrapper` puts `libnss_wrapper.so` under an arch-specific multiarch dir (`/usr/lib/x86_64-linux-gnu` vs `/usr/lib/aarch64-linux-gnu`). Resolve it at build time to a fixed path (e.g. symlink `/usr/local/lib/libnss_wrapper.so`) so the entrypoint's `LD_PRELOAD` is arch-independent.
- `LD_PRELOAD`/`NSS_WRAPPER_*` must survive nested `env -i` calls; per `environment.md`, #729's `_engine_dispatch_run_native` forwards them. #728 only has to set them in the entrypoint and keep the files under `$HOME` (on the `/tmp` tmpfs).
- Arcanum's own code must not look the user up (`whoami`, `getent`, `os.userInfo()`); the smoke check only verifies the OS side.
- Multi-arch publishing (#737) will reuse the `runtime` target with buildx; nothing here should assume the build host's arch beyond `TARGETARCH`.
