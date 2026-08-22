# Extend IssueState.js with the four subcommands

Add `get`, `set`, `setJson`, and `appendJson` methods to `core/lib/IssueState.js`, plus a `run(repoPath, subcommand, id, field, value)` entrypoint that dispatches to them (mirroring `issue_state_shell.sh`'s `case` statement).

- `get(repoPath, id, field)` — reads the state file (reuse `_read`) and returns the field's value, or `''` if the file/field is absent. Never throws for a missing file/field.
- `set(repoPath, id, field, value)` — acquires the lock (`this._lock`), reads current state, merges `{ [field]: value }` (string), writes back, releases the lock. Reuse `write`'s lock/read/merge/write body — either by having `set` call `write(repoPath, id, { [field]: value })` directly, or by extracting the shared lock/read/write skeleton into a private helper both call.
- `setJson(repoPath, id, field, jsonValue)` — same as `set`, but `jsonValue` is parsed as JSON before merging (`.[$field] = <parsed value>`).
- `appendJson(repoPath, id, field, jsonValue)` — read current state, compute `(current[field] || []).concat([parsed jsonValue])`, then merge that back in under the same lock (reuse the same skeleton — this is the one case that needs the *current* field value as part of the merge, unlike `set`/`setJson`'s unconditional overwrite, so it can't just delegate to `write` as-is; still reuse `_read`/the lock acquire-release pair).
- `run(repoPath, subcommand, id, field, value)` — validates `repoPath` via `RepoPath#validate`, then dispatches on `subcommand`:
  - `get` → returns `` `${await this.get(...)}\n` `` (or matches whatever exact trailing-newline behavior `issue_state_shell.sh` has once extracted — verify against the shell script directly, don't assume).
  - `set`/`set-json`/`append-json` → calls the matching method, returns `''` (no stdout) on success.
  - unknown subcommand → throws an `Error` whose message matches `Unknown command: <command>` plus the usage lines (see `PermissionGrant.js`'s `USAGE_MESSAGE` constant pattern) — `core/bin/arcanum`'s dispatcher catches this, writes it to stderr, and exits 1.
  - missing required args → same usage-message-on-stderr, exit-1 shape.

## Files to Change

- `core/lib/IssueState.js` — add `get`/`set`/`setJson`/`appendJson`/`run` methods, reusing `_read`/`_lock`/`write`'s internals per the "Shared contracts" note above.
