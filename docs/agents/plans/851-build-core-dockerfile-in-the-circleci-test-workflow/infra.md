# Plan: Build core/Dockerfile in the CircleCI test workflow

Issue: [851-build-core-dockerfile-in-the-circleci-test-workflow.md](../../issues/851-build-core-dockerfile-in-the-circleci-test-workflow.md)

## Overview
Add a `runtime-image` job to the CircleCI `test` workflow that runs `make core-smoke-runtime` on the `machine` executor (`ubuntu-2204:current`). It builds only the `runtime` target, native linux/amd64, with no push and no Docker Hub login, then runs the existing smoke checks against it.

## Context
Today only the release-only `publish-image` job builds `core/Dockerfile`, after `build-and-release` has already created the GitHub release. #850 (a Debian security update that broke the `jq` apt pin) was only found there and needed a fix release (2.2.1). `make core-smoke-runtime` already exists and depends on `core-build-runtime` (`docker build -f core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=$(RUNTIME_VERSION) -t darthjee/arcanum:local-test .`, with `RUNTIME_VERSION` read from `arcanum.version`). It then runs the image as the host uid with `--read-only --tmpfs /tmp` and checks the CLI entrypoint, the nss_wrapper passwd entry/ssh/git/gh, a native config command resolving `shared/`, and the baked `arcanum.json` version. All of it needs a local Docker daemon, which is why the job uses a machine executor and not `setup_remote_docker`.

## Implementation Steps

### Step 1 — Add the `runtime-image` job
In `.circleci/config.yml`, add a `runtime-image` job under `jobs:`:

```yaml
  runtime-image:
    machine:
      image: ubuntu-2204:current
    steps:
      - checkout
      - run:
          name: Build and smoke-test the runtime image
          command: make core-smoke-runtime
```

Then add it to the `test` workflow with the same filter as its siblings (`filters: tags: ignore: /.*/`), with no path filters and no `requires`. Do not use buildx or QEMU, and do not log in to Docker Hub: plain `docker build` on the amd64 machine is enough, and the build pulls the public `darthjee/node` base image anonymously. Before relying on it, check that `make` and `tr` are present on `ubuntu-2204:current`. They are part of the standard image; if `make` were missing, install it in a step before the smoke run.

### Step 2 — Document the job in the config header
Add a paragraph to the header comment of `.circleci/config.yml`, in the style of the existing `mod-checks`/`cli` paragraphs. It should say that the `runtime-image` job (test workflow) runs `make core-smoke-runtime` on a machine executor (a local Docker daemon, needed for the smoke's `--user`/`--read-only`/`--tmpfs` runs), builds only the amd64 `runtime` target without pushing, and exists so that image breakage (e.g. #850's stale apt pin) fails on the branch instead of in the release-only `publish-image` job. Mention that it has no path filters, since upstream drift (Debian mirrors, the base image) can break the build with no repo change.

## Files to Change
- `.circleci/config.yml` — new `runtime-image` job, its entry in the `test` workflow, and a header-comment paragraph.

## CI Checks
- repo root: `make core-smoke-runtime` (CI job: `runtime-image`, new)

## Notes
- Out of scope: building the `test` target (it only adds an entrypoint on top of `base`, which the runtime build already covers), and arm64/multi-arch builds (still only in `publish-image`).
- The architect should update `docs/agents/architecture/docker-engine.md` when reviewing (infra does not own architecture docs). In the `## Testing` table, add a runtime-smoke row: "the `runtime` image builds and its entrypoint, user setup, tools and baked version work", run in the CircleCI `runtime-image` job and by `make core-smoke-runtime`, needs Docker. In `### Not in CI, and why`, change the machine-executor bullet: a machine executor job now exists for the build and smoke check, but parity specs still stay local-only.
- The job adds a few minutes of machine-executor time per pipeline, with no Docker layer caching. That is accepted as the cost of catching image breakage before a release.
