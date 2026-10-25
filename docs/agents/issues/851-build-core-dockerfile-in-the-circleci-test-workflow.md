# Issue: Build core/Dockerfile in the CircleCI test workflow

## Description
No job in the CircleCI `test` workflow builds `core/Dockerfile`. The only job that does is the release-only `publish-image`, which runs after `build-and-release` has already created the GitHub release for the tag.

## Problem
Image-build breakage — e.g. an apt pin that Debian no longer serves, as in #850 — is only discovered after a release tag exists, forcing a follow-up fix release (2.2.1 after #850). Runtime breakage of the built image (entrypoint, nss_wrapper user setup, bundled tools) is likewise never exercised in CI.

## Expected Behavior
Every branch/PR build in the `test` workflow builds the `runtime` target of `core/Dockerfile` and smoke-tests it, so a change (or an upstream change) that breaks the image build or the image's basic runtime fails CI before release.

## Solution
Add a `test`-workflow job (owned by the `infra` agent) that:

- runs on the `machine` executor with `ubuntu-2204:current`, the same as `publish-image` (a real Docker daemon, so the smoke's `--user`/`--read-only`/`--tmpfs` runs work);
- runs `make core-smoke-runtime` from the repo root. That target depends on `core-build-runtime`, which builds only the `runtime` target (`docker build`, native linux/amd64 — no QEMU/buildx multi-arch, no push, no Docker Hub login), with `ARCANUM_VERSION` read from `arcanum.version`; it then runs the existing smoke checks (CLI starts as the host uid, passwd entry/ssh/git/gh, native config command resolves `shared/`, `arcanum.json` version).

Out of scope: building the `test` target (it only adds an entrypoint on top of `base`, which the runtime build already covers) and multi-arch (arm64) builds.

Follow the existing `test`-workflow conventions: `filters: tags: ignore: /.*/` and no path filters. Document the job in the header comment of `.circleci/config.yml`.

## Benefits
- Image build and basic runtime failures surface on the PR that causes them, not after a release tag.
- Upstream drift (Debian security updates, base image changes) is caught on the next CI run.
- CI reuses the same `make core-smoke-runtime` target developers run locally, so there is one definition of the check.
