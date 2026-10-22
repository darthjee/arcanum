# Repoint the architecture docs

- **`docs/agents/architecture/lock-system.md`** (line 6): `shared/lib/file/Lock.js`. While there, mention `LockTimeoutError` (`shared/lib/file/LockTimeoutError.js`) if the doc doesn't already, and link to [Shared Lib](shared-lib.md#writer-api) for `RepoConfigWriter`'s `timeoutMs` pass-through.
- **`docs/agents/architecture/docker-engine.md`** (line 150): `shared/lib/file/Lock.js`. Leave line 48 (`core/lib/utils/file/InstallRoot.js` stays in core) and line 439 (`core/lib/utils/io/TtyPrompt.js` stays in core). Where the doc describes what the runtime image contains, add `shared/` next to `core/` if it lists the folders.
- **`docs/agents/architecture/shared-state-and-configuration.md`** (lines 23 and 27): `shared/lib/config/keys.json` and `shared/lib/config/KeyRegistry.js`. Say the registry is owned by `shared`, with the exception that lets any agent add a key, and link to [Shared Lib](shared-lib.md#ownership). Check whether "Nothing reads it at runtime yet" still holds by grepping `KeyRegistry` usages in `core/lib` and `cli/lib`, and correct it if not.
- Grep the rest of `docs/agents/architecture/` (e.g. `script-engine.md`, `overview-and-layout.md`, `install-and-release.md`) for the moved file names or for "`core/lib`" descriptions of the config surface, and repoint any you find. Where `overview-and-layout.md` or `script-engine.md` lists the repo's top-level code folders, add `shared/` with a link to [Shared Lib](shared-lib.md).

## Files to Change

- `docs/agents/architecture/lock-system.md`
- `docs/agents/architecture/docker-engine.md`
- `docs/agents/architecture/shared-state-and-configuration.md`
- any other `docs/agents/architecture/*.md` the grep turns up
