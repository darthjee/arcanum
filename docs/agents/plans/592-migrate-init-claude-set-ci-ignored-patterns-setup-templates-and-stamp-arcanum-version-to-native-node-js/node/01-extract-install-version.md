# Extract the install-version resolver

`ArcanumUpdateRunUpdate#_currentVersion` already reads the zip version (`arcanum.json` `.version`) and the exact git tag (`git describe --tags --exact-match`), but it adds a `git rev-parse --short HEAD` fallback that stamping must not use. Extract the shared part into a util. Constructor-injectable `readFile` / `existsSync` / `execFileAsync` make it testable.

- `zipVersion(installRoot)` → `arcanum.json` `.version`, or `''` if the file is missing, malformed, or has no `.version`.
- `exactTag(installRoot)` → the trimmed `git -C <installRoot> describe --tags --exact-match` output, or `''` on failure.
- `resolve(installRoot)` → mirrors `stamp_arcanum_version.sh`: `zipVersion` if `arcanum.json` exists, else `exactTag` if `.git` exists, else `''`.

Refactor `ArcanumUpdateRunUpdate#_currentVersion` to use `zipVersion` / `exactTag` and keep its short-hash fallback locally. Its zip branch currently lets a malformed `arcanum.json` throw. Keep that behavior, either by keeping a strict variant or by leaving that branch as it is. The `arcanum-update` output contract must not change.

## Files to Change
- `core/lib/utils/file/InstallVersion.js` — new util.
- `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` — delegates to it.
- `core/spec/lib/utils/file/InstallVersion_spec.js` — new unit spec.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate*_spec.js` — adjust stubs only if needed.
