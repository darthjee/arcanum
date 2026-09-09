# Migrate ArcanumUpdateRunUpdate to take claudeContext

Change `ArcanumUpdateRunUpdate`'s constructor to the `PermissionGrant` shape
(`constructor(claudeContext, { lock } = {})`) and stop threading `repoPath` through every
method — resolve the install's paths from the injected `claudeContext` instead.

## Files to Change

- `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`:
  - Constructor becomes
    `constructor(claudeContext, { execFileAsync, spawnFn, readFile, existsSync } = {})`;
    store `this._claudeContext = claudeContext` alongside the existing collaborator
    assignments.
  - `check()` loses its `repoPath` parameter. Body becomes:
    `const { method, repo } = await this._resolveTarget(); const current = await this._currentVersion(method);`
    and the returned `TARGET=` line uses `this._claudeContext.installRoot()` instead of
    the old `repoPath` parameter.
  - `apply()` loses its `repoPath` parameter. `_resolveTarget()`/`_currentVersion(method)`
    are called with no path argument; the bootstrap script path becomes
    `this._claudeContext.bootstrapPath()` instead of
    `path.join(repoPath, 'arcanum', 'update', 'bootstrap.sh')` (the `path` import may
    become unused here — check whether anything else in the file still needs it before
    removing the import).
  - `_resolveTarget()` loses its `repoPath` parameter. Use
    `this._claudeContext.bootstrapPath()` / `.arcanumJsonPath()` / `.gitDirPath()` in place
    of the manually-`path.join`ed equivalents, but keep doing the `existsSync` checks and
    throwing `DispatchFailure('STATUS=missing_arcanum\n', 1)` locally exactly as today —
    do **not** delegate to `ClaudeContext#validateInstall()` (see [node.md](../node.md)'s
    Notes for why: its anti-drift `realpath` check would fail every unit/parity test
    fixture, which are never this repo's own `INSTALL_ROOT`).
  - `_readRepoFromArcanumJson(arcanumJsonPath)` is unchanged (already takes a path, not
    `repoPath`) — just called with `this._claudeContext.arcanumJsonPath()` now.
  - `_parseGithubOwnerRepo()` loses its `repoPath` parameter; runs
    `git -C <installRoot> remote get-url origin` using
    `this._claudeContext.installRoot()` in place of `repoPath`.
  - `_currentVersion(method)` loses its `repoPath` parameter; every `git -C <repoPath> ...`
    / `path.join(repoPath, 'arcanum.json')` call becomes
    `this._claudeContext.installRoot()` / `this._claudeContext.arcanumJsonPath()`
    respectively.
  - Update every method's JSDoc to drop the `@param {string} repoPath` entries that no
    longer apply, and note `claudeContext` on the constructor's JSDoc instead.
