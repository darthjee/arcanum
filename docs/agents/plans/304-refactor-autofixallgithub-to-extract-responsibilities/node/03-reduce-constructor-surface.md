# Reduce the constructor surface

With Steps 01 and 02 in place, `AutoFixAllGithub` only genuinely needs three
collaborators — `RepoContextFactory` absorbs the rest. Flatten the constructor.

## Target constructor

```js
constructor({
  repoContextFactory = new RepoContextFactory(),
  issueTaggerFactory = (bundle) =>
    new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient }),
  branchCleanup = new BranchCleanup()
} = {}) {
  this._repoContextFactory = repoContextFactory;
  this._issueTaggerFactory = issueTaggerFactory;
  this._branchCleanup = branchCleanup;
}
```

- Remove the `origin`, `githubToken`, `issueStateService`, `configChain`,
  `execFileAsync`, `fetchFn`, `timeoutMs` constructor params and their
  `this._*` fields — they now live only inside `RepoContextFactory`'s
  constructor.
- Remove the now-unused imports from `AutoFixAllGithub.js`: `Origin`,
  `GithubToken`, `GitClient`, `GitBranch`, `Git`, `GitHubClient`,
  `RepoContext`, `TAG_TO_LABEL` (verify each against the final file — keep
  `IssueTagger`, `IssueClient`, `DispatchFailure`, `BranchCleanup`,
  `RepoContextFactory`, `TagMutationService`, `PrOperations`).
- `branchCleanup` default becomes a bare `new BranchCleanup()` (it has its own
  `execFileAsync` default); tests needing a fake exec pass
  `new BranchCleanup({ execFileAsync })` explicitly.
- Do **not** add a `collaborators` wrapper object — rejected in the issue as
  cosmetic.
- Zero-arg `new AutoFixAllGithub()` must still work (used by
  `AutoFixAllWaitCiAndMerge.js`); the public method surface (`prNumber`,
  `prState`, `prMerge`, `cleanupBranch`, `hasShipitLabel`, `addTag`,
  `removeTag`) is unchanged.
- Rewrite the class/constructor JSDoc to describe the 3-collaborator shape;
  drop the long paragraphs about forwarding `fetchFn`/`execFileAsync` into
  per-call clients (that story now belongs to `RepoContextFactory`).

## Tests

- `core/spec/lib/commands/AutoFixAllGithub_spec.js`: rewrite the single
  `newGithub(overrides)` helper so it builds
  `new AutoFixAllGithub({ repoContextFactory: new RepoContextFactory({ origin,
  githubToken, issueStateService, configChain, execFileAsync: fakeExecFileAsync(),
  fetchFn: fakeFetch(), timeoutMs: 5 }), branchCleanup: new BranchCleanup({
  execFileAsync: fakeExecFileAsync() }), ...overrides })`. Keep the fake
  `origin` / `githubToken` / `issueStateService` / `configChain` /
  `fakeFetch` / `fakeExecFileAsync` builders as-is — only where they are
  wired changes.
  - The `overrides` contract for the existing tests that pass
    `{ origin, githubToken, fetchFn, execFileAsync }` needs updating: those
    tests now construct their own `RepoContextFactory` with the spies (or the
    helper accepts `factoryOverrides` and merges). Pick whichever keeps the
    existing per-test assertions (`originWithRef` / `tokenGet` call counts,
    per-call `cwd` routing) working with the least churn.
- The `describe('constructor wiring')` specs that assert shared
  `origin`/`githubToken` instances across `issueTagger`/`prOperations`/
  `branchCleanup` now assert that sharing **through the injected
  `RepoContextFactory`** — same intent, one indirection deeper.
- `yarn lint` clean (no unused imports/vars left behind).
- All `core/spec/bin/autoFixAllGithubParity/*` specs green and untouched.

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — flatten constructor to 3 params;
  drop dead imports and `this._*` fields; rewrite constructor/class JSDoc.
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — rework the `newGithub()`
  helper and the `constructor wiring` assertions for the 3-dep shape;
  behavior specs otherwise unchanged.
