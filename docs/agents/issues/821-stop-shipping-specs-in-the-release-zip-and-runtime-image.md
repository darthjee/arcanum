# Issue: Stop shipping specs in the release zip and runtime image

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent). See the epic and [the shared-lib spec](docs/agents/specs/shared-lib.md) for the full design decisions.

Spec folders are dev-only, but `core/spec/` ships today in both the release zip and the runtime image. That is 379 files. `cli/spec/` is already left out, because the whole `cli/` tree is excluded.

## Problem

- `scripts/build_release_zip.sh` packages every git-tracked file except its `EXCLUDES` list. `core/spec/` is not in that list, so every install gets the whole spec tree.
- The runtime image does `COPY . /opt/arcanum`, filtered by the root `.dockerignore`, which mirrors `EXCLUDES`. So the image carries `core/spec/` too.
- Step 5 of #816 (#822) adds `shared/spec/`. Without this change it would ship as well.

## Expected Behavior

- `build_release_zip.sh --list`, and so the `MANIFEST`, contains no `*/spec/` path.
- The runtime image's `/opt/arcanum` has no `core/spec/` and no `shared/spec/`.
- Existing zip installs lose `core/spec/` on their next update, through the updater's `MANIFEST` diff. Git-clone installs are unaffected: they keep the full tree by design.
- Nothing else changes for dev or CI:
  - The `test` stage of `core/Dockerfile` bind-mounts the repo instead of copying it.
  - The parity specs (`make docker-parity`) run on the host and use the image as a black box.
  - `make core-smoke-runtime` never touches specs.

## Solution

Owner: `infra`.

- **`scripts/build_release_zip.sh`:** add `core/spec/` and `shared/spec/` to `EXCLUDES`. The existing trailing-`/` prefix match covers both. Adding `shared/spec/` before the folder exists is intended: when #822 lands it, it is already excluded.
- **`.dockerignore`:** add the same two entries to the "Mirrors EXCLUDES" block, in the same order, so the two stay in sync.
- **Packaging spec:** extend `core/spec/release/buildReleaseZipList_spec.js`, the existing `--list` spec, with one case: no listed path matches `(^|/)spec/`. Update its header comment to mention #821. The spec lives in `core/spec/` and runs in dev and CI, so excluding the folder from the zip does not affect it.
- **Docs (architect):** add one line to `docs/agents/architecture/install-and-release.md` saying spec folders are not packaged. Update the `.dockerignore` line in `docs/agents/architecture/docker-engine.md` (§ Image) to match.

Runtime check: nothing in `core/lib`, `core/bin` or `arcanum/` loads anything from `core/spec` at runtime. The only reference is a comment in `core/lib/core/commands.js`.

Out of scope:
- other dev-only files in the zip and the image (#817);
- the `shared/lib/` packaging assertion (#823).

Dependencies: none. This must land before #822 (step 5 of #816), so that `shared/spec/` never ships.

## Benefits

- Smaller release zip and runtime image.
- Dev-only code stays out of user installs.
- `shared/spec/` is excluded before it exists, so it never ships.
- The new packaging assertion catches any future `spec/` folder that would otherwise ship.
