# Migrate SpawnIssue and its caller

## `core/lib/commands/SpawnIssue.js`

- **Constructor** → `constructor(repoContext, { execFileAsync, sleepFn, labelApplicator, issueLinker } = {})`.
  - Store `this._repoContext = repoContext`.
  - Keep `execFileAsync` (defaults to `defaultExecFileAsync`), `sleepFn`
    (defaults to `defaultSleep`), `labelApplicator`
    (`new LabelApplicator({ execFileAsync })`), `issueLinker`
    (`new IssueLinker({ execFileAsync })`) injectable — unchanged defaults.
  - **Remove** the `repoPath` (`RepoPath`), `origin` (`Origin`), `githubIssue`
    (`GithubIssue`), and `configChain` constructor params — they existed only to
    feed `_repoContext(repoPath)`. Drop the now-unused imports (`Origin`,
    `GithubIssue`, `RepoContext`; keep `RepoPath` only if still referenced —
    see below) and the corresponding `this._repoPath` / `this._origin` /
    `this._githubIssue` / `this._configChain` fields.
  - Update the constructor JSDoc block accordingly.
- **Delete `_repoContext(repoPath)`** entirely.
- **`run`** → `run(parentId, title, bodyFile, asSubissueFlag)` — drop the leading
  `repoPath` parameter.
  - Derive `const repoPath = this._repoContext.repoPath;` at the top.
  - Presence guard: `if (!repoPath || !parentId || !title || !bodyFile)` stays
    (now `repoPath` comes from the context). Keep the `USAGE` string as-is.
  - Replace `const context = this._repoContext(repoPath);` with
    `const context = this._repoContext;`.
  - `context.resolve()`, `context.readConfig('plan-issues', …)`,
    `context.createIssue(…)` calls are unchanged.
  - `this._labelApplicator.apply(parentId, newId, repo)`,
    `this._issueLinker.link(…)`, `this._cleanup(repoPath, newFile)` are
    unchanged — `repo` still comes from `context.resolve()`, `repoPath` from the
    local `const`.
  - Update the `run` JSDoc (drop the `@param repoPath`).
- **`RepoPath` validation**: `run` currently calls `await this._repoPath.validate(repoPath)`.
  There is no longer a `repoPath` collaborator. Follow the #311
  `AutoFixAllWaitCi` precedent: keep a `repoPathValidator = new RepoPath()`
  injectable in the constructor's deps object and call
  `await this._repoPathValidator.validate(repoPath)`. (Keeps the "not a
  directory" error parity that `SpawnIssue_spec.js` / the parity suite exercise.)

## `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`

- Constructor default → `spawnIssue = new SpawnIssue(repoContext)` (the
  `repoContext` positional param is in scope in the default expression).
- `_spawn(...)` → change
  `this._spawnIssue.run(this._repoContext.repoPath, issueId, title, bodyFile, AS_SUBISSUE_FLAG)`
  to `this._spawnIssue.run(issueId, title, bodyFile, AS_SUBISSUE_FLAG)`.
- Update the `_spawn` JSDoc `@returns`/prose reference if it mentions the
  `repoPath` argument.

## `core/spec/lib/commands/SpawnIssue_spec.js`

- `stubDeps`: drop the `repoPath` / `origin` / `configChain` flat keys. Keep
  `sleepFn`, `labelApplicator`, `issueLinker`; add
  `repoPathValidator: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) }`.
- Construction: build a real `RepoContext` with fake low-level deps (mirror
  `AutoFixAllWaitCi_spec.js` / `ArcanumSplitIssueCreateSubIssue_spec.js`):
  `new SpawnIssue(new RepoContext({ repoPath, origin, configChain, githubIssue }), { ...deps })`
  where `origin` = `{ resolve: async () => ({ domain: DOMAIN, repo: REPO_REF }) }`,
  `configChain` = `{ read: async () => undefined }` (or per-test overrides),
  `githubIssue` = `{ create: <spy> }`. The existing per-test `githubIssue`
  override moves into the `RepoContext`.
- Every `spawnIssue.run(repoPath, '1', 'New issue', bodyFile[, '--as-subissue'])`
  call loses its leading `repoPath` → `spawnIssue.run('1', 'New issue', bodyFile[, …])`
  (~9 call sites).
- The "missing repo_path" / usage-error test now constructs the context with
  `repoPath: ''` (or omitted) and still expects the `USAGE` rejection.
- The repo-path validation-failure test targets `repoPathValidator.validate`
  instead of the old `repoPath.validate`.

## `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js`

- `deps.spawnIssue` is already a stub, so the `new SpawnIssue(repoContext)`
  default is never hit — no construction change needed.
- Update the `expect(deps.spawnIssue.run).toHaveBeenCalledWith(repoPath, ISSUE_ID, title, tmpBodyFile, '--as-subissue')`
  assertions to drop the leading `repoPath` argument.
- Line ~204: `const [, , , bodyFile] = deps.spawnIssue.run.calls.mostRecent().args;`
  → `const [, , bodyFile] = ...` (one fewer leading arg).

## Files to Change

- `core/lib/commands/SpawnIssue.js` — constructor signature, delete
  `_repoContext`, `run` signature + body, imports, JSDoc.
- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js` — `new SpawnIssue(repoContext)`
  default, drop `repoPath` from the `_spawn` delegation.
- `core/spec/lib/commands/SpawnIssue_spec.js` — `stubDeps`, `RepoContext`-based
  construction, drop `repoPath` from all `run(...)` calls.
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js` — drop
  `repoPath` from `spawnIssue.run` call assertions and the args destructure.
