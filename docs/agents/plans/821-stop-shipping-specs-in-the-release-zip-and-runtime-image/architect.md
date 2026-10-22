# Architect Plan: Stop shipping specs in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- The excluded spec folders are exactly `core/spec/` and `shared/spec/`, in that order. They go in `EXCLUDES` in `scripts/build_release_zip.sh` and in the "Mirrors scripts/build_release_zip.sh EXCLUDES." block of the root `.dockerignore`, after `cli/` and before `arcanum.version`.
- After the change, `scripts/build_release_zip.sh --list` prints no path matching the regex `(^|/)spec/`. Today only `core/spec/` matches, with 379 files: `cli/spec/` is already excluded through `cli/`, and `shared/spec/` does not exist yet (#822).
- No runtime behavior changes. Nothing in `core/lib`, `core/bin` or `arcanum/` reads `core/spec/`.

## Implementation Steps

### Step 1 — Document that specs are not shipped
- In `docs/agents/architecture/install-and-release.md`, where the zip contents and `EXCLUDES` are described, add a line saying spec folders (`core/spec/`, `shared/spec/`) are dev-only and never packaged. Say the `--list` packaging spec enforces this. Note that existing zip installs drop `core/spec/` on their next update, through the `MANIFEST` diff.
- In `docs/agents/architecture/docker-engine.md` § Image, update the `.dockerignore` line, which today reads "keeps `core/node_modules`, `coverage/`, `.git` and `docs/` out of the context". Add the spec folders, and say the file mirrors `EXCLUDES`.

## Files to Change
- `docs/agents/architecture/install-and-release.md`: the new line.
- `docs/agents/architecture/docker-engine.md`: the updated `.dockerignore` line.

## Notes
- The broader shared-lib doc work stays in #826.
