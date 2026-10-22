# Node Plan: Stop shipping specs in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- The excluded spec folders are exactly `core/spec/` and `shared/spec/`, in that order. They go in `EXCLUDES` in `scripts/build_release_zip.sh` and in the "Mirrors scripts/build_release_zip.sh EXCLUDES." block of the root `.dockerignore`, after `cli/` and before `arcanum.version`.
- After the change, `scripts/build_release_zip.sh --list` prints no path matching the regex `(^|/)spec/`. Today only `core/spec/` matches, with 379 files: `cli/spec/` is already excluded through `cli/`, and `shared/spec/` does not exist yet (#822).
- No runtime behavior changes. Nothing in `core/lib`, `core/bin` or `arcanum/` reads `core/spec/`.

## Implementation Steps

### Step 1 — Assert no spec folder is packaged
In `core/spec/release/buildReleaseZipList_spec.js`, add a case next to "lists nothing under cli/": "lists nothing under any spec/ folder". It asserts that `paths.filter((line) => /(^|\/)spec\//.test(line))` equals `[]`. Keep the same style as the file's other cases: a named constant for the pattern, and `toEqual([])` so a failure prints the offending paths. Extend the header comment to say the spec also asserts that spec folders are never shipped (issue #821).

## Files to Change
- `core/spec/release/buildReleaseZipList_spec.js`: the new case and the header comment.

## CI Checks
- `core`: `make core-test` (CI job: `test`), plus lint (CI job: `checks`).

## Notes
- This spec lives inside `core/spec/` and keeps running in dev and CI. Excluding the folder only affects what ships.
- The case fails until infra's `EXCLUDES` change lands. Both land in the same PR.
