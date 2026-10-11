# Plan: Publish the multi-arch runtime Docker image from release CI

Issue: [737-publish-the-multi-arch-runtime-docker-image-from-release-ci.md](../../issues/737-publish-the-multi-arch-runtime-docker-image-from-release-ci.md)

## Overview
Publish the `runtime` target of `core/Dockerfile` to Docker Hub as `darthjee/arcanum:<version>` (one multi-arch manifest) from release CI, after the release zip is published.

## Context
- Docker dispatch (epic #724) pulls `darthjee/arcanum:<version>` and builds locally only if the pull fails. Nothing publishes that tag yet.
- `core/Dockerfile` builds `FROM darthjee/node:0.2.1`, which is `linux/amd64` only. darthjee/docker#148 publishes a multi-arch `darthjee/node` tag. This issue is **blocked until #148 ships**.
- `.circleci/config.yml` has one release job, `build-and-release` (`cimg/base:stable`, no Docker), in the `release` workflow, filtered to tags `^\d+\.\d+\.\d+$` with all branches ignored.
- Decisions from the issue: push only the version tag (no `latest`); credentials come from the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` project env vars; the job **fails** when the tag already exists, even on a re-run; it runs after `build-and-release`.

## Steps

- [01 — Bump the base image to the multi-arch darthjee/node](infra/01-bump-base-image.md)
- [02 — Add the publish-image release job](infra/02-add-publish-image-job.md)
- [03 — Update the docker spec](infra/03-update-spec.md)

## CI Checks
- `.circleci/config.yml`: `circleci config validate` (if the CLI is available). The job itself only runs on release tags, so it can't be exercised on the PR.
- `core/Dockerfile`: `make core-build-runtime` and `make core-smoke-runtime`; `make core-test` for the `test` target (CI job: `test`, which uses `darthjee/circleci_node`, not this Dockerfile).
- Optional local multi-arch check: `docker buildx build -f core/Dockerfile --target runtime --platform linux/amd64,linux/arm64 --build-arg ARCANUM_VERSION=0.0.0 .` (no `--push`).

## Notes
- **Blocker:** don't start step 01 until darthjee/docker#148 has published a multi-arch `darthjee/node` tag (`docker buildx imagetools inspect darthjee/node:<tag>` lists both platforms).
- Manual prerequisites outside the PR, before the first release that runs this job: create the `darthjee/arcanum` Docker Hub repository, and set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (an access token with push rights) on the CircleCI project.
- The image job runs after the zip upload, so a failed image push leaves a release whose zip exists but whose image doesn't. Dispatch still works then, because it falls back to a local build.
- Step 03 edits spec docs under `docs/agents/specs/`. If those are out of infra's scope, the architect takes that step.
