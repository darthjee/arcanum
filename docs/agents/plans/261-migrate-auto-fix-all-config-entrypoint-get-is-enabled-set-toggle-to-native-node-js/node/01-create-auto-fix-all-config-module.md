# Create AutoFixAllConfig.js

Create `core/lib/AutoFixAllConfig.js`, a zero-runtime-dependency class implementing the 4 subcommands of `auto-fix-all/scripts/config.sh`, re-deriving `arcanum/_lib/repo_config.sh`'s new/legacy file split and `repo_config_read`/`repo_config_write` logic natively (no shared native helper exists for this yet — `core/lib/RepoConfig.js` is unrelated, see `node.md`'s Notes).

Class shape, mirroring the constructor-injectable-collaborators pattern used throughout `core/lib/` (e.g. `PermissionGrant.js`, `GithubIssue.js`):

```js
class AutoFixAllConfig {
  constructor({ lock = new Lock() } = {}) { this._lock = lock; }

  async get(repoPath, key) { ... }        // returns "<value>\n"
  async isEnabled(repoPath, key) { ... }   // returns undefined, or throws DispatchFailure('', 1)
  async set(repoPath, key, value) { ... }  // returns undefined, or throws Error
  async toggle(repoPath, key) { ... }      // returns "<new_value>\n"
}
```

Internal helpers (private methods), mirroring `config.sh`'s own:
- `_newFileForKey(repoPath, key)`: `clear_context`/`finish_on_empty_queue` → `path.join(repoPath, '.claude', 'state', 'arcanum-config.json')`; everything else → `path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json')`.
- `_legacyFileForKey(repoPath, key)`: `clear_context`/`finish_on_empty_queue` → `null` (no fallback); everything else → `path.join(repoPath, '.claude', 'configuration', 'auto-fix-all.json')`.
- `_read(newFile, legacyFile, key)`: read `.auto-fix-all.<key>` from `newFile` if present (JSON parse, missing/unreadable/malformed file → treat as absent); presence-checked, so an explicit `false` counts. Otherwise, if `legacyFile` is non-null and exists, read `<key>` from its top level. Otherwise return `undefined`.
- `_write(newFile, legacyFile, key, value)`: acquire `this._lock.acquire(`${newFile}.lock`)` first. Read `newFile` (default `{}` if missing/malformed). If `.auto-fix-all` isn't already present on it and `legacyFile` exists and is valid JSON, seed `.auto-fix-all` from the full legacy file contents first (mirrors `_repo_config_seed_locked`). Set `.auto-fix-all.<key> = value`. Write atomically (write to `${newFile}.tmp`, then rename — same pattern as `PermissionGrant.js#add`), creating `newFile`'s parent directory if needed. Always `this._lock.release(...)` in a `finally`.

`get`/`isEnabled` both resolve the value the same way (`VALUE="${VALUE:-false}"` in the shell): `_read(...) ?? 'false'`.

`set` validates: throw `new Error('Error: set requires a key and a value (true|false)')` if `key`/`value` is missing (`arguments.length` / undefined check, mirroring the shell's `$# -lt 3` check); throw `new Error("Error: value must be 'true' or 'false'")` if `value` isn't exactly `'true'` or `'false'`. Otherwise `_write(...)` and resolve (no return value).

`toggle` resolves the current value (default `'false'`), flips it, `_write(...)`s the new value, and returns `` `${newValue}\n` ``.

`isEnabled` returns nothing (implicit `undefined`) when the resolved value is `'true'`; otherwise `throw new DispatchFailure('', 1)` — import `DispatchFailure` from `./DispatchFailure.js`.

## Files to Change

- `core/lib/AutoFixAllConfig.js` — new module implementing `get`/`isEnabled`/`set`/`toggle`.
