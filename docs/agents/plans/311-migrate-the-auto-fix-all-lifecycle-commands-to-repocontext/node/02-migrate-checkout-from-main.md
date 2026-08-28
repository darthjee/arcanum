# Migrate AutoFixAllCheckoutFromMain

Straightforward application of the migration recipe. This command already
validates via an injected `RepoPath` and injects `execFileAsync`; both stay as
test deps in the second options arg.

## What to do

- `core/lib/core/commands.js`: add `takesRepoContext: true` to the
  `auto-fix-all-checkout-from-main` entry.
- Constructor: `constructor(repoContext, { execFileAsync = defaultExecFileAsync,
  repoPath = new RepoPath({ execFileAsync }) } = {})`. Store
  `this._repoContext = repoContext`; keep `this._execFileAsync` and
  `this._repoPath` as today.
- `run(repoPath, id)` → `run(id)`:
  - `if (!this._repoContext.repoPath || !id) throw new Error(USAGE);` (USAGE
    string unchanged).
  - `await this._repoPath.validate(this._repoContext.repoPath);` (unchanged
    behavior).
  - Replace every remaining `repoPath` reference in `run` and in the private
    helpers `_fetchTolerant(repoPath, ref)` / `_refExists(repoPath, ref)` with
    `this._repoContext.repoPath`. Simplest: drop the `repoPath` parameter from
    both helpers and read `this._repoContext.repoPath` inside them (they are
    private and only ever called with the one value).
- No behavior change to stdout/exit codes — parity spec untouched.

## Tests

`core/spec/lib/commands/AutoFixAllCheckoutFromMain_spec.js`:

- Where tests do `new AutoFixAllCheckoutFromMain({ execFileAsync: execFileSpy,
  repoPath })`, change to
  `new AutoFixAllCheckoutFromMain(repoContext, { execFileAsync: execFileSpy, repoPath })`
  where `repoContext` is a `{ repoPath: <the path the test used> }` stand-in (or
  `createRepoContextMock({ repoPath })`).
- Where tests do `new AutoFixAllCheckoutFromMain()` (real deps) and then
  `run(SOME_PATH, id)`: pass the context as
  `new AutoFixAllCheckoutFromMain({ repoPath: SOME_PATH } ...)` — but these
  cases rely on the real `RepoPath#validate`, so keep using a real-ish path or
  the existing expectation of a validation error, just sourced from the context
  now.
- All `run(path, id)` call sites become `run(id)` with `path` moved into the
  constructor's context arg. The "missing repo_path" test now constructs with
  `{ repoPath: '' }` (or no repoPath) and calls `run(id)`.

## Files to Change

- `core/lib/core/commands.js` — flag on `auto-fix-all-checkout-from-main`.
- `core/lib/commands/AutoFixAllCheckoutFromMain.js` — constructor + `run` +
  `_fetchTolerant` + `_refExists`.
- `core/spec/lib/commands/AutoFixAllCheckoutFromMain_spec.js` — construct with
  context; `run(id)` call sites.
