# Native unit spec

Create `core/spec/lib/AutoFixAllConfig_spec.js` (Jasmine, mirrors `core/lib/AutoFixAllConfig.js` 1:1 per convention — see `PermissionGrant_spec.js`/`RepoConfig_spec.js` for style: temp-dir-backed fixture files, no mocking of the filesystem itself). Use `createTempDir`/`removeTempDir` from `core/spec/support/utils/tempDir.js` to build a fake `repoPath` per test.

Cover, for each of the 4 methods:

- **`get`**: value present in the new file → returned; value present only in the legacy file (new file missing or missing that key) → returned; absent from both → `"false\n"`; `clear_context`/`finish_on_empty_queue` never fall back to the legacy file even when the legacy file has that key (asserts the no-legacy-fallback branch explicitly, seeding a legacy file with `clear_context` present and confirming it's ignored).
- **`isEnabled`**: resolved `"true"` → resolves with no thrown error; resolved `"false"`/absent → rejects with a `DispatchFailure` whose `.stdout === ''` and `.exitCode === 1`.
- **`set`**: valid `true`/`false` write lands in the new file under `.auto-fix-all.<key>`, preserving any other existing namespaces/keys already in that file; write seeds `.auto-fix-all` from the legacy file first if the new file didn't have that namespace yet (assert the seeded sibling keys survive); missing key/value → rejects with `Error('Error: set requires a key and a value (true|false)')`; invalid value (e.g. `"yes"`) → rejects with `Error("Error: value must be 'true' or 'false'")`.
- **`toggle`**: `"true"` → `"false\n"` and the new file is updated; absent (defaults `"false"`) → `"true\n"`.
- Route selection: a key like `clear_context` resolves against `.claude/state/arcanum-config.json`; any other key (e.g. `auto_merge`) resolves against `.claude/configuration/arcanum-repo-config.json`.

Inject a fake/spy `Lock` (constructor DI, per `plan.md`'s shared contract and the `AutoFixAllConfig.js` constructor shape from step 01) to assert `acquire`/`release` are called around `set`/`toggle` writes without waiting on the real 1000ms `Lock` sleep — same technique `PermissionGrant_spec.js` already uses for its own lock-backed writes.

## Files to Change

- `core/spec/lib/AutoFixAllConfig_spec.js` — new unit spec covering all 4 methods per the cases above.
