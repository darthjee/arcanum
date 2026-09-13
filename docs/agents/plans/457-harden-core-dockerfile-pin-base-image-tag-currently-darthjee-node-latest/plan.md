# Plan: Harden core/Dockerfile: pin base image tag (currently darthjee/node:latest)

Issue: [457-harden-core-dockerfile-pin-base-image-tag-currently-darthjee-node-latest.md](../../issues/457-harden-core-dockerfile-pin-base-image-tag-currently-darthjee-node-latest.md)

## Overview
Replace `core/Dockerfile`'s floating `FROM darthjee/node:latest` with the pinned version tag `darthjee/node:0.2.1`, and update the documentation that references the base image so it matches. No digest pinning and no Renovate/Dependabot automation — future bumps stay manual and deliberate.

See [infra.md](infra.md) for the full plan.
