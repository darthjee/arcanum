# Plan: Stop shipping specs in the release zip and runtime image

Issue: [821-stop-shipping-specs-in-the-release-zip-and-runtime-image.md](../../issues/821-stop-shipping-specs-in-the-release-zip-and-runtime-image.md)

## Overview
Exclude the dev-only spec folders (`core/spec/` now, `shared/spec/` ahead of #822) from the release zip and the runtime image's build context, by adding them to `EXCLUDES` and the mirrored `.dockerignore` block. Lock this in with a packaging spec, and note it in the architecture docs.

## Agents involved

- [infra](infra.md): `scripts/build_release_zip.sh` `EXCLUDES` and the root `.dockerignore`.
- [node](node.md): the packaging-spec case in `core/spec/release/buildReleaseZipList_spec.js`.
- [architect](architect.md): `install-and-release.md` and `docker-engine.md`.

## Shared contracts

- The excluded spec folders are exactly `core/spec/` and `shared/spec/`, in that order. They go in `EXCLUDES` in `scripts/build_release_zip.sh` and in the "Mirrors scripts/build_release_zip.sh EXCLUDES." block of the root `.dockerignore`, after `cli/` and before `arcanum.version`.
- After the change, `scripts/build_release_zip.sh --list` prints no path matching the regex `(^|/)spec/`. Today only `core/spec/` matches, with 379 files: `cli/spec/` is already excluded through `cli/`, and `shared/spec/` does not exist yet (#822).
- No runtime behavior changes. Nothing in `core/lib`, `core/bin` or `arcanum/` reads `core/spec/`.
