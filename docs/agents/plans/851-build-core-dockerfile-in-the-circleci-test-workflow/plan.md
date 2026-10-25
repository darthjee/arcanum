# Plan: Build core/Dockerfile in the CircleCI test workflow

Issue: [851-build-core-dockerfile-in-the-circleci-test-workflow.md](../../issues/851-build-core-dockerfile-in-the-circleci-test-workflow.md)

## Overview
Add a `runtime-image` job to the CircleCI `test` workflow that runs `make core-smoke-runtime` on a machine executor, so every branch build builds and smoke-tests the `runtime` target of `core/Dockerfile` before a release tag exists.

See [infra.md](infra.md) for the full plan.
