# Add createIssue to RepoContext

Add `GithubIssue` as a fifth collaborator on `RepoContext` (core/lib/context/RepoContext.js), alongside the existing `Origin`, `GithubToken`, `IssueStateService`, and `ConfigChain`. Expose a narrow `createIssue(title, bodyFile)` delegate — not a raw `getGithubIssue()` getter — matching every other `RepoContext` method (`resolve()`, `getToken()`, `getIssueState()`, `readConfig()`), all of which are narrow delegates that never hand back their underlying collaborator.

- Constructor: add `githubIssue = new GithubIssue()` to the destructured deps, store as `this._githubIssue`.
- New method: `async createIssue(title, bodyFile) { return this._githubIssue.create(this.repoPath, title, bodyFile); }`.

## Files to Change

- `core/lib/context/RepoContext.js` — add `githubIssue` constructor dep + `createIssue(title, bodyFile)` delegate method.
- `core/spec/lib/context/RepoContext_spec.js` — add coverage for `createIssue` delegating to `githubIssue.create` with `(repoPath, title, bodyFile)`.
- `core/spec/support/factories/repoContextFactory.js` — check whether the factory needs a `githubIssue` double added to its default deps; add one if other specs will need to stub `createIssue`.
