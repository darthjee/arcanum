# Create RepoContext + spec + helper

Add `RepoContext`, a new class that centralizes `repoPath` plus the 4 dependencies `PrOperations` currently takes individually (`origin`, `githubToken`, `issueState`, `configChain`), each defaulting the same way `PrOperations`'s constructor does today. It exposes one async method per current call site's need: `resolveWithRef()`, `resolve()`, `getToken()`, `getIssueState(id, key)`, `readConfig(scope, key)` — thin delegations to the wrapped collaborators, always passing `this.repoPath` as their first argument.

This step is purely additive — `RepoContext` isn't imported by any existing file yet (that happens in step 06), so it can't break anything today.

```js
class RepoContext {
  constructor({
    repoPath,
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueState = new IssueState(),
    configChain = new ConfigChain()
  } = {}) {
    this.repoPath = repoPath;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._configChain = configChain;
  }

  async resolveWithRef()       { return this._origin.resolveWithRef(this.repoPath); }
  async resolve()              { return this._origin.resolve(this.repoPath); }
  async getToken()             { return this._githubToken.get(this.repoPath); }
  async getIssueState(id, key) { return this._issueState.get(this.repoPath, id, key); }
  async readConfig(scope, key) { return this._configChain.read(this.repoPath, scope, key); }
}
```

Also add `repoContextFactory.js`, a spec-support helper (grouped with the repo's other setup/mock-builder helpers) that builds a `RepoContext` wired to jasmine spies, for reuse by `PrOperations_spec.js` (step 05) and `MergeBodyResolver_spec.js` (step 04):

```js
export function createRepoContextMock({ repoPath = '/fake/repo', ...overrides } = {}) {
  const origin = { resolveWithRef: jasmine.createSpy(), resolve: jasmine.createSpy(), ...overrides.origin };
  const githubToken = { get: jasmine.createSpy(), ...overrides.githubToken };
  const issueState = { get: jasmine.createSpy(), ...overrides.issueState };
  const configChain = { read: jasmine.createSpy(), ...overrides.configChain };
  return new RepoContext({ repoPath, origin, githubToken, issueState, configChain });
}
```

`RepoContext_spec.js` mocks `origin`/`githubToken`/`issueState`/`configChain` and verifies each method delegates to the right collaborator with `repoPath` (and, where applicable, `id`/`key`/`scope`) forwarded correctly.

## Files to Change

- `core/lib/context/RepoContext.js` — new class (see above)
- `core/spec/lib/context/RepoContext_spec.js` — new unit spec, verifies delegation
- `core/spec/support/factories/repoContextFactory.js` — new spec-support helper (see above)
