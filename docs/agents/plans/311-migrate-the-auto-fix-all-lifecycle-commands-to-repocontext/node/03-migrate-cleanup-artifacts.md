# Migrate AutoFixAllCleanupArtifacts

Same shape as Step 2. This command also injects `execFileAsync` (a custom
stdin-capable variant) and a `RepoPath`; both stay as test deps.

## What to do

- `core/lib/core/commands.js`: add `takesRepoContext: true` to the
  `auto-fix-all-cleanup-artifacts` entry.
- Constructor: `constructor(repoContext, { execFileAsync = defaultExecFileAsync,
  repoPath = new RepoPath({ execFileAsync }) } = {})`. Store
  `this._repoContext = repoContext`; keep `this._execFileAsync` /
  `this._repoPath`.
- `run(repoPath, issueFile, planDir, id, modelName, modelEmail)` →
  `run(issueFile, planDir, id, modelName, modelEmail)`:
  - `if (!this._repoContext.repoPath || !issueFile || !planDir || !id ||
    !modelName || !modelEmail) throw new Error(USAGE);` (USAGE unchanged).
  - `await this._repoPath.validate(this._repoContext.repoPath);`
  - Replace `repoPath` throughout `run` and in the private helpers
    `_isTracked` / `_isDirectory` / `_nothingStaged` / `_commit` /
    `_pushCurrentBranch` with `this._repoContext.repoPath` — drop the `repoPath`
    parameter from those helpers (all private, all called with the one value).
- No stdout/exit-code change — parity spec untouched.

## Tests

`core/spec/lib/commands/AutoFixAllCleanupArtifacts_spec.js`:

- `new AutoFixAllCleanupArtifacts({ execFileAsync, repoPath: repoPathDep })` →
  `new AutoFixAllCleanupArtifacts(repoContext, { execFileAsync, repoPath: repoPathDep })`
  with `repoContext` a `{ repoPath: <path> }` stand-in / `createRepoContextMock`.
- Every `run(REPO_PATH, ...)` → `run(...)` with `REPO_PATH` moved into the
  constructor's context arg.
- The missing-`repoPath` usage test constructs with `{ repoPath: '' }` and calls
  `run(issueFile, planDir, id, name, email)`.

## Files to Change

- `core/lib/core/commands.js` — flag on `auto-fix-all-cleanup-artifacts`.
- `core/lib/commands/AutoFixAllCleanupArtifacts.js` — constructor + `run` +
  `_isTracked` / `_isDirectory` / `_nothingStaged` / `_commit` /
  `_pushCurrentBranch`.
- `core/spec/lib/commands/AutoFixAllCleanupArtifacts_spec.js` — construct with
  context; adjust `run(...)` call sites.
