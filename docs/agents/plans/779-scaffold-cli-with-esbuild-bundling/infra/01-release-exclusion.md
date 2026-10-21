# Keep cli/ out of the release zip and image

Add `cli/` to `EXCLUDES` in `scripts/build_release_zip.sh`, and to the first block of the root `.dockerignore`, which mirrors `EXCLUDES` and must stay in sync. Arcanum installs and the runtime image must never carry a CLI copy (see [Packaging and Release → Code layout](../../../specs/arcanum-cli/packaging-and-release.md#code-layout)). Check that `scripts/build_release_zip.sh --list` prints no `cli/` path.

## Files to Change

- `scripts/build_release_zip.sh` — `cli/` in `EXCLUDES`.
- `.dockerignore` — `cli/` in the mirrored block.
