# Branch Dispatcher on the context enum

Update `core/lib/core/dispatcher.js` to act on `this.entry.context` instead of
`this.entry.takesRepoContext`.

- `commandInstance()` — replace the ternary with a three-way branch:
  - `'repo'` → `new ModuleClass(this.repoContext)`
  - `'claude'` → `new ModuleClass(this.claudeContext)`
  - default (`'none'` / absent) → `new ModuleClass()`
- Add a `get claudeContext()` — lazy + memoized exactly like the existing
  `get repoContext()`, returning
  `new ClaudeContext({ repoPath: this.args[0] })`. Import `ClaudeContext` from
  `../context/ClaudeContext.js`.
- `commandArgs()` — strip the leading arg for **both** context-bound kinds:
  `return this.entry.context === 'repo' || this.entry.context === 'claude'
  ? this.args.slice(1) : this.args;`
  (a small `_takesContext()` / `isContextBound` helper is fine to avoid
  repeating the check across `commandInstance` and `commandArgs`).
- Update the class-level JSDoc and the `commandInstance` / `repoContext` /
  `commandArgs` method docs: replace "`takesRepoContext` flag-on path" wording
  with the `context` enum.

Update `core/spec/lib/core/dispatcher_spec.js`:

- Rename/keep the existing `dispatch-fixture` block ("flag-off" → "context:
  'none'") and the `dispatch-fixture-repo-context` block ("flag-on" → "context:
  'repo'") — assertions unchanged (still builds a `RepoContext` from `args[0]`,
  still strips the leading arg).
- Add a `context: 'claude'` block. There is no claude-specific test fixture
  command, so drive it through `permission-grant` directly:
  `new Dispatcher('permission-grant', ['/fake/anchor', 'add', '/tmp/x.json', 'Bash(x)'])`
  and assert `commandInstance()` yields a `PermissionGrant` whose injected
  context is a `ClaudeContext` with `repoPath === '/fake/anchor'`, and that
  `commandArgs()` returns `['add', '/tmp/x.json', 'Bash(x)']`. Do not call
  `dispatch()` here (it would touch the filesystem) — `commandInstance()` /
  `commandArgs()` are enough, matching how the repo-context block is structured.
- Add a `claudeContext` getter block mirroring the `repoContext` getter block
  (lazy: `_claudeContext` undefined until first read; memoized: same instance on
  repeated reads).

## Files to Change

- `core/lib/core/dispatcher.js` — `context`-enum branch in `commandInstance()`,
  new lazy `claudeContext` getter, `commandArgs()` strip for `'repo'`/`'claude'`,
  JSDoc updates.
- `core/spec/lib/core/dispatcher_spec.js` — rename the two existing context
  blocks, add a `context: 'claude'` block and a `claudeContext` getter block.
