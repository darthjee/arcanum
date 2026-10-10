# Issue: Build the runtime Docker image for engine.mode=docker

## Description

Part of epic #724 (implement `engine.mode=docker`). Build the `runtime` Docker image that `engine.mode=docker` runs commands in, as specified in `docs/agents/specs/docker/image.md` (written in #726). The `test` image used by the `core-*` Make targets must keep working unchanged.

Out of scope: the `engine_dispatch.sh` docker branch, pull/build-on-demand logic, `make docker-parity` and the mounts/env passed to `docker run` (all #729), and the release-CI multi-arch publishing job (split out to #737).

Owner: **infra**.

## Problem

`core/Dockerfile` today is a test-only image: it installs dependencies at every container start, runs its entrypoint as root and `chown`s mount points, and has neither `git`, `gh` nor `openssh-client` pinned, nor the arcanum install baked in. It cannot run arcanum commands against a user's repo safely or quickly, so `engine.mode=docker` has no image to run in.

## Expected Behavior

- `docker build -f core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=<version> -t darthjee/arcanum:<version> <install root>` produces an image whose entrypoint `exec`s `/opt/arcanum/core/bin/arcanum "$@"`.
- The container runs correctly as an arbitrary non-root `--user uid:gid` with `--read-only` and `--tmpfs /tmp`: no root phase, no `chown`, no `su`.
- `ssh` (and so `git` over SSH) works for that uid; `InstallVersion` inside the container resolves the same version as on the host.
- `make core-test`, `core-lint`, `core-check`, `core-shell`, `core-report`, `core-audit` keep working unchanged.

## Solution

Follow `docs/agents/specs/docker/image.md`; the decisions it leaves to #728 are settled here.

**Multi-stage `core/Dockerfile`:**
- `base`: `darthjee/node:<x.y.z>` pinned by **exact tag only** (no digest), shared by both targets. Pinned `jq`, `git`, `openssh-client` and `libnss-wrapper` as `pkg=<version>` with `--no-install-recommends`, each with a comment on how to refresh the pin (same convention as today's `jq`).
- **`gh` from the release tarball**: pinned version, per-arch SHA-256 selected via `TARGETARCH` (amd64/arm64), verified before extraction; refresh procedure written next to the pin. No third-party apt repo.
- `test`: today's behavior unchanged (source bind-mounted, `core/docker-entrypoint.sh`, `yarn install --frozen-lockfile && yarn test`). Adjust `core/docker-compose.yml` `context`/`dockerfile`/`target` as needed for the new build context. Keep the existing Semgrep/`.codacy.yml` suppression scoped to the test stage.
- `runtime`: copies the install layout (same file set as `scripts/build_release_zip.sh`) to `/opt/arcanum`; `yarn install --production --frozen-lockfile` in `/opt/arcanum/core`; writes `/opt/arcanum/arcanum.json` with `ARCANUM_VERSION`; `ENV HOME=/tmp/arcanum-home`; its own entrypoint; no `USER` root phase.

**Runtime user — `nss_wrapper`:** the runtime entrypoint (small `sh` script) creates `$HOME`, writes a one-line passwd and group file for the current uid/gid under it, sets `LD_PRELOAD`, `NSS_WRAPPER_PASSWD`, `NSS_WRAPPER_GROUP`, then `exec`s the arcanum CLI. No writable `/etc/passwd`, no root. Must survive nested `env -i` calls per `environment.md` (container-infrastructure env). The git credential helper / `safe.directory` stay in dispatch env (#729), not in the entrypoint.

**Build context:** the install root with `-f core/Dockerfile`; add a `.dockerignore` excluding `core/node_modules`, `coverage/`, `.git`, `docs/`.

**Makefile:** add a target (e.g. `core-build-runtime`) that builds the `runtime` target locally as `darthjee/arcanum:local-test` (version arg from the install), plus a smoke check that runs the image as a non-root uid (`--user "$(id -u):$(id -g)" --read-only --tmpfs /tmp`) and verifies the arcanum CLI starts and `ssh`/`getent`-style user lookup succeeds. #729's `docker-parity` can reuse the build target.

**Docs:** update `docs/agents/specs/docker/image.md` to record the final choices (nss_wrapper, gh tarball, tag-only pin) and the `core/Dockerfile` header comment.

## Benefits

- Gives #729 a ready, verifiable image to wire `engine.mode=docker` dispatch onto.
- One Dockerfile keeps test and runtime pins in lockstep, so parity specs under `test` say something about `runtime`.
- Runs as the host user with no root phase, so it is safe against a user's repo.
