# Add ClaudeContext

Create `core/lib/context/ClaudeContext.js` as a peer to `RepoContext` — a small,
zero-I/O per-call bundle that anchors resolution of Claude Code's native
settings files. It is a separate concern from `RepoContext`, **not** a field on
it, and it does not wrap any of `RepoContext`'s collaborators
(`origin` / `githubToken` / `issueStateService` / `configChain` / `githubIssue`).

Shape:

- `constructor({ repoPath } = {})` — store `repoPath` (the `<anchor>`). Same key
  name as `RepoContext` for consistency. No other constructor deps are needed;
  add an injectable `env = process.env` only if the global-path helper below
  reads `CLAUDE_CONFIG_DIR` / `HOME` (preferred, mirrors
  `InvocationLog`'s injectable `env`).
- `resolve(file)` → `path.isAbsolute(file) ? file : path.resolve(this.repoPath, file)`.
  This is the method `PermissionGrant` uses to kill the ambient-cwd dependency
  when the caller passes a repo-relative `.claude/settings.json`.
- `localSettingsPath()` → `path.join(this.repoPath, '.claude', 'settings.local.json')`
- `projectSettingsPath()` → `path.join(this.repoPath, '.claude', 'settings.json')`
- `globalSettingsPath()` →
  `path.join(this._env.CLAUDE_CONFIG_DIR || path.join(this._env.HOME, '.claude'), 'settings.json')`

Keep every method pure (string building only) — no `fs` access, matching
`RepoContext`'s constructor-cost profile.

Add `core/spec/lib/context/ClaudeContext_spec.js` covering: relative vs absolute
`resolve`, the three tier paths, and `CLAUDE_CONFIG_DIR` set vs unset (falls back
to `$HOME/.claude`). Follow `core/spec/lib/context/RepoContext_spec.js` for
structure.

## Files to Change

- `core/lib/context/ClaudeContext.js` — new file; the class described above.
- `core/spec/lib/context/ClaudeContext_spec.js` — new file; unit specs for
  `resolve` and the tier-path/`CLAUDE_CONFIG_DIR` behaviour.
