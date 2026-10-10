# Plan: Build the runtime Docker image for engine.mode=docker

Issue: [728-build-the-runtime-docker-image-for-engine-mode-docker.md](../../issues/728-build-the-runtime-docker-image-for-engine-mode-docker.md)

## Overview

Turn `core/Dockerfile` into a multi-stage file (`base` → `test` / `runtime`) per `docs/agents/specs/docker/image.md`, add the runtime entrypoint (nss_wrapper passwd entry), a `.dockerignore` for the install-root build context, and a Makefile target that builds and smoke-checks the runtime image. Single owner: infra.

See [infra.md](infra.md) for the full plan.
