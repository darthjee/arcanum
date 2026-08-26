# Update RepoContext and its dependents

`RepoContext` (core/lib/context/RepoContext.js) is the actual layering violation this issue exists to fix — it currently imports the command class `IssueState` directly.

- Remove `import IssueState from '../commands/IssueState.js'`; import `IssueStateService` from `../services/IssueStateService.js` instead.
- Rename the constructor's `issueState` dependency to `issueStateService`. It cannot use a destructured default (`new IssueStateService({ context: this })` needs `this.repoPath` to already be set, and destructured parameter defaults run before the constructor body assigns `this.repoPath`), so build it explicitly in the constructor body after `this.repoPath = repoPath` is assigned:
  ```js
  constructor({ repoPath, origin = new Origin(), githubToken = new GithubToken(), issueStateService, configChain = new ConfigChain() } = {}) {
    this.repoPath = repoPath;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueStateService = issueStateService ?? new IssueStateService({ context: this });
    this._configChain = configChain;
  }
  ```
- `getIssueState(id, key)` now calls `this._issueStateService.get(id, key)` — 2 arguments, not 3; `repoPath` is no longer passed explicitly since it's already bound into `this._issueStateService`'s own `context`.

Update the shared test factory `core/spec/support/factories/repoContextFactory.js`:
- Rename the `issueState` local/option to `issueStateService`.
- Drop `repoPath` from the fake's `get` spy signature — callers now fake `get: jasmine.createSpy()` expecting `(id, field)`, not `(repoPath, id, field)`.
- Update its JSDoc accordingly.

Update `core/spec/lib/context/RepoContext_spec.js`:
- Rename its `issueState` overrides to `issueStateService`.
- Update the `#getIssueState` test ("delegates to issueState.get with repoPath, id, and key") to assert delegation to `issueStateService.get(id, key)` — 2 args.

Update `core/spec/lib/utils/github/PrOperations_spec.js`'s `newPrOperations` helper (it uses `createRepoContextMock`):
- Rename its `issueState` override key to `issueStateService`.
- Change the fake's signature from `get: jasmine.createSpy().and.callFake(async (repoPath, id, field) => issueStateValues[field] ?? '')` to `get: jasmine.createSpy().and.callFake(async (id, field) => issueStateValues[field] ?? '')`.

## Files to Change

- `core/lib/context/RepoContext.js` — `issueState` → `issueStateService`, 2-arg `getIssueState`.
- `core/spec/support/factories/repoContextFactory.js` — rename + drop `repoPath` from the `get` fake.
- `core/spec/lib/context/RepoContext_spec.js` — rename + 2-arg assertion.
- `core/spec/lib/utils/github/PrOperations_spec.js` — rename + 2-arg fake signature.
