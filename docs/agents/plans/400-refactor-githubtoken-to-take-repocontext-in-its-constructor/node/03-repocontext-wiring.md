# Migrate the RepoContext / RepoContextFactory wiring

Have `RepoContext` construct its own `GithubToken` bound to itself and call `get()` with no
argument; stop `RepoContextFactory` from sharing a single `GithubToken` instance.

## What to do

### RepoContext.js

- The `githubToken = new GithubToken()` destructuring default cannot reference `this`, so
  move it into the constructor body:
  ```js
  constructor({ repoPath, origin = new Origin(), githubToken, issueStateService,
    configChain = new ConfigChain(), githubIssueService = new GithubIssueService(),
    repoPathValidator = new RepoPath() } = {}) {
    this.repoPath = repoPath;
    // ...
    this._githubToken = githubToken ?? new GithubToken({ repoContext: this });
    // ...
  }
  ```
  An injected `githubToken` (specs, and the factory if it keeps forwarding one) still wins.
- `getToken()`: change `return this._githubToken.get(this.repoPath);` to
  `return this._githubToken.get();`. Update the method JSDoc note.
- `githubIssueService = new GithubIssueService()` default: optionally pass
  `{ repoContext: this }` here too (move into the body next to `_githubToken`) so
  `RepoContext#createIssue`'s `this._githubIssueService.create(this.repoPath, ...)` could
  later drop its `this.repoPath` argument. Keep the explicit `this.repoPath` in
  `createIssue` for now (dual mode covers it); the constructor wiring is the only change
  needed to make the follow-up trivial. If this widens the diff or breaks specs
  unexpectedly, skip it — it is not required by the issue's "Done when".

### RepoContextFactory.js

- Remove the `githubToken = new GithubToken()` constructor default and the
  `this._githubToken = githubToken;` line, and drop `githubToken: this._githubToken` from
  the `new RepoContext({ ... })` call in `build()` — each `RepoContext` now builds its own.
- Remove the now-unused `import GithubToken from '../utils/github/GithubToken.js';`.
- Update the class/constructor JSDoc that mentions the "shared `origin`/`githubToken` pair".
- If removing the param ripples into callers that pass `githubToken` to the factory, prefer
  keeping the param accepted-but-ignored over a large diff — note which was done in the PR.

### Specs

- `core/spec/support/factories/repoContextFactory.js` — `createRepoContextMock` passes a
  `githubToken` spy explicitly into `RepoContext`, so it keeps overriding the self-built
  instance and needs no change. Verify `githubToken.get` is still asserted without a
  `repoPath` arg wherever specs check it (update those expectations:
  `expect(githubToken.get).toHaveBeenCalledWith()` instead of `...With('/fake/repo')`).
- `core/spec/lib/context/RepoContext_spec.js` — update the `getToken` expectation to
  `get()` with no args. Add/adjust a case proving that with **no** injected `githubToken`,
  `RepoContext` builds one carrying itself as `repoContext` (e.g. stub `GithubToken` via a
  spy dep, or assert `getToken()` resolves against `this.repoPath` through a faked
  `execFileAsync`).
- `core/spec/lib/context/RepoContextFactory_spec.js` — drop any assertion about a shared
  `githubToken` being forwarded; assert each built `context` still exposes a working
  `getToken`.

## Files to Change

- `core/lib/context/RepoContext.js` — build `GithubToken`/`GithubIssueService` in the
  constructor body with `{ repoContext: this }`; `getToken()` calls `get()` arg-free; JSDoc.
- `core/lib/context/RepoContextFactory.js` — stop sharing/forwarding a `GithubToken`
  instance; remove the import; JSDoc.
- `core/spec/lib/context/RepoContext_spec.js` — `getToken` no-arg expectation; self-built
  `GithubToken` coverage.
- `core/spec/lib/context/RepoContextFactory_spec.js` — drop shared-`githubToken`
  assertions.
- `core/spec/support/factories/repoContextFactory.js` — adjust `githubToken.get` call
  expectations if referenced (no structural change to the factory itself).
