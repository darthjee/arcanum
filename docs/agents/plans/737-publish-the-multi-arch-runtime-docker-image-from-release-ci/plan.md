# Plan: Publish the multi-arch runtime Docker image from release CI

Issue: [737-publish-the-multi-arch-runtime-docker-image-from-release-ci.md](../../issues/737-publish-the-multi-arch-runtime-docker-image-from-release-ci.md)

## Overview
Add a `publish-image` job to the CircleCI `release` workflow. It runs after the release zip is uploaded and pushes `darthjee/arcanum:<tag>` as one `linux/amd64` + `linux/arm64` manifest, failing if the tag already exists. First, `core/Dockerfile` moves to the multi-arch `darthjee/node` base from darthjee/docker#148. The spec text in `docs/agents/specs/` is updated to match.

See [infra.md](infra.md) for the full plan.
