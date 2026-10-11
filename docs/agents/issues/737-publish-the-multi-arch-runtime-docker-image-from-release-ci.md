# Issue: Publish the multi-arch runtime Docker image from release CI

## Description
Part of epic #724 (implement `engine.mode=docker`). Split out of #728 (closed), which builds the `runtime` target of `core/Dockerfile` but does not publish it.

Add the release-CI job described in `docs/agents/specs/docker/image.md` ("Distribution and versioning"): build the `runtime` target with buildx for `linux/amd64` and `linux/arm64` and push `darthjee/arcanum:<version>` as one multi-arch manifest, after the release zip is published.

Owner: `infra` (CI job, Dockerfile base bump), with the `architect` updating the spec text.

Depends on darthjee/docker#148 (multi-arch `darthjee/node` base).

## Problem
Docker dispatch resolves `darthjee/arcanum:<version>` and tries to pull it before falling back to a local build. Nothing publishes that tag today, so every user pays the local-build cost on first use of each version.

Blocker: every published `darthjee/node` tag, including `0.2.1` (the current `core/Dockerfile` base), is `linux/amd64` only (single-arch manifest). A buildx `linux/arm64` build of the `runtime` target can't resolve its `FROM` until darthjee/docker#148 publishes a multi-arch `darthjee/node` tag.

## Expected Behavior
- On a release tag build (`^\d+\.\d+\.\d+$`), after the release zip is uploaded, CI publishes `darthjee/arcanum:<tag>` as one multi-arch manifest covering `linux/amd64` and `linux/arm64`.
- Only the version tag is pushed: no `latest` or other moving tag.
- If `darthjee/arcanum:<tag>` already exists, the job **fails** and does not build or push. This holds on workflow re-runs too, per the spec's immutable-tags rule.
- Branch builds never publish.

## Solution
- **Base image bump:** once darthjee/docker#148 ships, change `core/Dockerfile`'s `FROM darthjee/node:0.2.1` to the new multi-arch tag, then re-check every apt pin against it (as the pin comment requires). Verify that both `--target test` and `--target runtime` still build.
- **New `publish-image` job** in `.circleci/config.yml`, added to the `release` workflow with the same tag-only filter and `requires: [build-and-release]`.
  - Executor that supports buildx multi-platform builds (e.g. CircleCI `machine` image), with QEMU/binfmt registered for the non-native platform.
  - Log in to Docker Hub with `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` project env vars (same pattern as `GH_TOKEN`), and document them in the config header comment.
  - Immutability guard: if `docker buildx imagetools inspect darthjee/arcanum:$CIRCLE_TAG` succeeds, fail with a clear message.
  - Build and push: `docker buildx build -f core/Dockerfile --target runtime --platform linux/amd64,linux/arm64 --build-arg ARCANUM_VERSION=$CIRCLE_TAG -t darthjee/arcanum:$CIRCLE_TAG --push .`, with the repo root as context (filtered by the root `.dockerignore`).
- **Spec:** update `docs/agents/specs/docker/image.md` ("Platforms" and "Distribution and versioning") to drop the amd64-only base caveat, name the new base tag, and describe the job's placement (after the zip upload), the credentials and the fail-on-existing-tag rule.
- One-time manual prerequisite, outside the PR: the `darthjee/arcanum` Docker Hub repository and the two CircleCI env vars must exist before the first release that runs this job.

## Benefits
Users get a prebuilt, native image for their architecture (Intel/AMD and Apple Silicon/arm64) on first docker dispatch, with no local build, and published tags can't be silently replaced.
