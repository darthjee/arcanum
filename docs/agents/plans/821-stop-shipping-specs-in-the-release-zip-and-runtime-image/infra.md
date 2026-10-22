# Infra Plan: Stop shipping specs in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- The excluded spec folders are exactly `core/spec/` and `shared/spec/`, in that order. They go in `EXCLUDES` in `scripts/build_release_zip.sh` and in the "Mirrors scripts/build_release_zip.sh EXCLUDES." block of the root `.dockerignore`, after `cli/` and before `arcanum.version`.
- After the change, `scripts/build_release_zip.sh --list` prints no path matching the regex `(^|/)spec/`. Today only `core/spec/` matches, with 379 files: `cli/spec/` is already excluded through `cli/`, and `shared/spec/` does not exist yet (#822).
- No runtime behavior changes. Nothing in `core/lib`, `core/bin` or `arcanum/` reads `core/spec/`.

## Implementation Steps

### Step 1 — Exclude spec folders from the release zip
Add `"core/spec/"` and `"shared/spec/"` to the `EXCLUDES` array in `scripts/build_release_zip.sh`, after `"cli/"`. The existing trailing-`/` prefix branch of `is_excluded` covers both, so no logic change is needed. If the script's header comment lists what is excluded, mention the spec folders there and say they are dev-only.

### Step 2 — Mirror the exclusion in `.dockerignore`
Add `core/spec/` and `shared/spec/` to the "Mirrors scripts/build_release_zip.sh EXCLUDES." block of the root `.dockerignore`, in the same position and order as in `EXCLUDES`. The `test` stage of `core/Dockerfile` bind-mounts the repo rather than copying it, so specs still run in the dev container. Only the `runtime` stage's `COPY . $ARCANUM_ROOT` is affected.

## Files to Change
- `scripts/build_release_zip.sh`: two new `EXCLUDES` entries.
- `.dockerignore`: the same two entries in the mirrored block.

## CI Checks
- `scripts/build_release_zip.sh --list | grep -E '(^|/)spec/'` prints nothing.
- `make core-smoke-runtime` still passes: it builds the runtime image and checks it.

## Notes
- `shared/spec/` is excluded before the folder exists. That is intended (#816 step 4 lands before step 5).
- Existing zip installs lose `core/spec/` on their next update, through the updater's `MANIFEST` diff. No updater change is needed.
