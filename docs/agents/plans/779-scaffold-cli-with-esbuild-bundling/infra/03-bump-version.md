# bump-version.sh lockstep

In `scripts/bump-version.sh`:

- Add `CLI_PACKAGE_FILE="${REPO_ROOT}/cli/package.json"`.
- After writing `arcanum.version`, rewrite the CLI version with `jq --arg v "$NEW_VERSION" '.version = $v'` through a temp file and `mv`. Fail loudly if the file is missing.
- Update the header comment and the "Updated …" output.

This keeps `client`'s lockstep spec (`cli/package.json` `version` equals `arcanum.version`) green across releases (see [Packaging and Release → Version lockstep](../../../specs/arcanum-cli/packaging-and-release.md#version-lockstep)).

Extend `scripts/test_bump_version.sh`:

- `build_fixture_repo` writes a fixture `cli/package.json` (`{"name":"arcanum-cli","version":"1.0.0"}`).
- The rewrite case asserts `.version == "1.1.0"` with other fields unchanged.
- The stale-reference abort case asserts it stays `1.0.0`.

Run it.

## Files to Change

- `scripts/bump-version.sh` — rewrite `cli/package.json`'s `version`.
- `scripts/test_bump_version.sh` — fixture and assertions.
