# Migrate AutoFixAllWaitCiAndMerge

Depends on Step 5 (its default child `AutoFixAllWaitCi` now takes a
`RepoContext`). Thin composition of `AutoFixAllWaitCi` (migrated) and
`AutoFixAllGithub` (NOT migrated — sub-issue 4, #312). Gains a
`RepoPath#validate` first step like `AutoFixAllWaitCi`.

## What to do

- `core/lib/core/commands.js`: add `takesRepoContext: true` to the
  `auto-fix-all-wait-ci-and-merge` entry.
- Constructor:
  ```js
  constructor(repoContext, {
    waitCi = new AutoFixAllWaitCi(repoContext),
    github = new AutoFixAllGithub(),
    repoPathValidator = new RepoPath()
  } = {})
  ```
  Store `this._repoContext = repoContext` and `this._repoPathValidator`. Note
  the default `waitCi` is built with the same injected `repoContext`. Add
  `import RepoPath from '../utils/file/RepoPath.js';`.
- `run(repoPath, modelEmail)` → `run(modelEmail)`:
  - `if (!this._repoContext.repoPath) throw new Error('Usage: wait_ci_and_merge.sh <repo_path> [model_email]');`
    — kept before validate, message unchanged.
  - `await this._repoPathValidator.validate(this._repoContext.repoPath);` — new.
  - `const waitOutput = await this._waitCi.run();` (no arg now).
  - `if (!waitOutput.startsWith('passed')) return waitOutput;`
  - `const mergeOutput = await this._github.prMerge(this._repoContext.repoPath, modelEmail);`
    — **interim asymmetry**: `AutoFixAllGithub#prMerge` still takes positional
    `repoPath` until #312. Add a short source comment saying so.
  - `return \`passed\n${mergeOutput}\`;`
- No stdout/exit-code change for the CI-passed / CI-failed paths — parity spec
  untouched (aside from the present-but-invalid-`repoPath` case, same rationale
  as Step 5).

## Tests

`core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js`:

- The spec builds a `deps` object with `waitCi` / `github` stubs and does
  `new AutoFixAllWaitCiAndMerge(deps)`. Change to
  `new AutoFixAllWaitCiAndMerge(repoContext, deps)` with `repoContext` a
  `{ repoPath: <path> }` stand-in / `createRepoContextMock`.
- Add `repoPathValidator: { validate: jasmine.createSpy().and.resolveTo(undefined) }`
  to `deps` so the real `RepoPath` isn't hit.
- The `waitCi` stub's `run` spy is now called with no args — assert
  `toHaveBeenCalledWith()` if the spec checks args.
- The `github` stub's `prMerge` spy is still called as
  `prMerge(<repoPath>, modelEmail)` — assert against `repoContext.repoPath`.
- `run(REPO_PATH, EMAIL)` → `run(EMAIL)`; the missing-`repoPath` usage test
  builds the context with `repoPath: ''` and calls `run(EMAIL)`.

## Files to Change

- `core/lib/core/commands.js` — flag on `auto-fix-all-wait-ci-and-merge`.
- `core/lib/commands/AutoFixAllWaitCiAndMerge.js` — import `RepoPath`;
  constructor (default `waitCi` from `repoContext`, add `repoPathValidator`);
  `run(modelEmail)` with validate + `this._repoContext.repoPath` for `prMerge`.
- `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js` — construct with
  context; inject `repoPathValidator`; `run(...)` call sites; `prMerge` arg
  assertion.
