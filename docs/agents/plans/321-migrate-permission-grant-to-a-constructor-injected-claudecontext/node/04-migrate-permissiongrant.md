# Migrate PermissionGrant to context: 'claude'

Wire `permission-grant` as a `context: 'claude'` command.

- `core/lib/core/commands.js` — change the `permission-grant` entry to
  `{ module: 'commands/PermissionGrant.js', method: 'run', context: 'claude' }`.
- `core/lib/commands/PermissionGrant.js`:
  - Constructor becomes
    `constructor(claudeContext, { lock = new Lock() } = {})` — leading context
    positional, then the deps object, matching `IssueState` / `SpawnIssue` /
    `ListAgents`. Store `this._claudeContext = claudeContext`.
  - `run(action, file, pattern)` — signature and the `action !== 'add'` usage
    guard are unchanged (Dispatcher already stripped the anchor).
  - `add(file, pattern)` — resolve the target through the context:
    `const target = this._claudeContext.resolve(file);` then use `target`
    everywhere the method currently uses `file` (the `mkdir`, the warning
    message, the lock file, `_merge`). When `file` is already absolute this is a
    no-op, so existing absolute-path behaviour is preserved; when it is
    repo-relative it now resolves against the anchor instead of `process.cwd()`.
  - Update the class JSDoc to mention the `ClaudeContext` and that the CLI path
    now takes a leading anchor.
- `core/spec/lib/commands/PermissionGrant_spec.js`:
  - Every `new PermissionGrant({ lock })` becomes
    `new PermissionGrant(claudeContext, { lock })` where `claudeContext` is a
    real `new ClaudeContext({ repoPath: dir })` (the temp dir the spec already
    builds) or a small stub exposing `resolve(f) => path.resolve(dir, f)`.
  - Keep passing absolute `file` paths in the existing cases (behaviour
    unchanged), and add one case that passes a **relative** file
    (`.claude/settings.json`) and asserts it lands under the context's
    `repoPath`, not `process.cwd()`.
  - The `action !== 'add'` / missing-action usage-message cases stay as-is.

## Files to Change

- `core/lib/core/commands.js` — `permission-grant` entry gains `context: 'claude'`.
- `core/lib/commands/PermissionGrant.js` — constructor takes `claudeContext`;
  `add()` routes `file` through `claudeContext.resolve()`; JSDoc.
- `core/spec/lib/commands/PermissionGrant_spec.js` — construct with the context
  arg; add a relative-path resolution case.
