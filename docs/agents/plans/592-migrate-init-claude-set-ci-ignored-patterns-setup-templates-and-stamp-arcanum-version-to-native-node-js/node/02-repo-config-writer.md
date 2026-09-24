# Add a native repo-config writer

`utils/config/RepoConfig.js` is read-only. Add a writer next to it that mirrors `arcanum/_lib/repo_config.sh` exactly (see the "Config file writes" shared contract):

- `write({ newFile, legacyFile, namespace, key, value })` — takes `<newFile>.lock`, seeds from the legacy file (the same rule as `_repo_config_seed_locked`), sets `.<namespace>.<key> = value`, writes atomically, and releases the lock.
- `setVersion({ file, version, namespace })` — takes `<file>.lock` and sets `.version`, or `.<namespace>.version` when a namespace is given.

Paths are absolute, resolved by the caller against `repoContext.repoPath`. Inject `Lock` and the fs functions for testing. Use a small `Lock` sleep in specs.

## Files to Change
- `core/lib/utils/config/RepoConfigWriter.js` — new.
- `core/spec/lib/utils/config/RepoConfigWriter_spec.js` — new. Cover: new file, existing file with other keys (order preserved), invalid-JSON file treated as `{}`, legacy seeding (and no reseed when the namespace exists), namespaced and top-level version, lock acquired and released (also when the write throws).
