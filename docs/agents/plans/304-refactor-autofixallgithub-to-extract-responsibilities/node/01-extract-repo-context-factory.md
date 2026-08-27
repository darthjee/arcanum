# Extract RepoContextFactory

Create `core/lib/context/RepoContextFactory.js` as the single place that, given
a `repoPath`, builds a `RepoContext` plus every context-bound client built
directly off it. Then adopt it in `AutoFixAllGithub._prOperations` and
`AutoFixAllGithub._issueTagger`, removing the two hand-rolled per-call
`RepoContext` builders.

## `RepoContextFactory` API

- **Constructor** `{ origin?, githubToken?, issueStateService?, configChain?,
  execFileAsync?, fetchFn?, timeoutMs? }`:
  - `origin` defaults to `new Origin()`, `githubToken` to `new GithubToken()`
    (mirror `RepoContext`'s own defaults).
  - `issueStateService` / `configChain` are forwarded as-is (may be
    `undefined`) into each `RepoContext` — `RepoContext` supplies its own
    defaults when they are absent. This is what lets `AutoFixAllWaitCi` (in
    #305) construct the factory without them; no per-call override API.
  - `execFileAsync` feeds each per-call `GitClient`.
  - `fetchFn` (default `fetch`) and `timeoutMs` feed **both** the per-call
    `GitHubClient` and the per-call `IssueClient`.
- **`build(repoPath)`** — the only method. Returns a fresh, flat bundle:

  ```js
  {
    context,      // new RepoContext({ repoPath, origin, githubToken,
                  //                   issueStateService, configChain })
    gitClient,    // new GitClient({ context, execFileAsync })
    gitBranch,    // new GitBranch({ context, gitClient })
    git,          // new Git({ context, gitBranch })
    githubClient, // new GitHubClient({ context, fetchFn, timeoutMs })
    issueClient   // new IssueClient({ context, fetchFn, timeoutMs })
  }
  ```

  Every value is a cheap, zero-I/O construction, so building the full bundle
  per call (even when a caller uses only part of it) has no meaningful cost —
  carry over the wording from `AutoFixAllGithub#_prOperations`'s current
  docstring.
- The factory does **not** build `IssueTagger` itself — that stays in
  `AutoFixAllGithub` via its `issueTaggerFactory`.

## Adoption in `AutoFixAllGithub`

- Add `import RepoContextFactory from '../context/RepoContextFactory.js';`.
- In this step, keep the existing constructor params (`origin`, `githubToken`,
  `issueStateService`, `configChain`, `execFileAsync`, `fetchFn`, `timeoutMs`,
  `issueTaggerFactory`, `branchCleanup`) but add a `repoContextFactory` param
  defaulting to a `new RepoContextFactory({ origin, githubToken,
  issueStateService, configChain, execFileAsync, fetchFn, timeoutMs })` built
  from them. (Step 03 removes the now-redundant individual params.)
- Change the default `issueTaggerFactory` to accept the **bundle** and read
  `.context` + `.issueClient` off it:
  `(bundle) => new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient })`.
- `_prOperations(repoPath)` becomes:
  `return new PrOperations(this._repoContextFactory.build(repoPath));`
  (the extra `issueClient` key on the bundle is ignored by `PrOperations`).
- `_issueTagger(repoPath)` becomes:
  `return this._issueTaggerFactory(this._repoContextFactory.build(repoPath));`
- Delete the two inline `RepoContext`/client construction blocks; move their
  explanatory docstrings onto the new factory / trimmed helpers.

## Tests

- New `core/spec/lib/context/RepoContextFactory_spec.js` (mirror
  `RepoContext_spec.js` style):
  - `build(repoPath)` returns all six keys; `context` is a `RepoContext` with
    the given `repoPath`.
  - injected `execFileAsync` reaches the returned `gitClient` (observe via a
    spy `execFileAsync` and a `gitClient` git call, or by asserting the spy is
    the one passed through).
  - injected `fetchFn` / `timeoutMs` reach **both** `githubClient` and
    `issueClient` (spy `fetchFn`, exercise one call on each).
  - omitting `issueStateService` / `configChain` still yields a usable
    `context` (defaults applied by `RepoContext`).
  - each `build()` call returns a distinct `context` instance.
- `AutoFixAllGithub_spec.js`: existing behavior specs must still pass. The
  `newGithub()` helper still injects the flat deps in this step (they still
  exist); no rewrite yet. Adjust only if a spec asserts on the internal shape
  of `issueTaggerFactory`'s argument (it now receives the bundle, not a bare
  context).
- All `core/spec/bin/autoFixAllGithubParity/*` specs stay green.

## Files to Change

- `core/lib/context/RepoContextFactory.js` — new; the factory described above.
- `core/lib/commands/AutoFixAllGithub.js` — import + construct
  `RepoContextFactory`; rewrite `_prOperations` / `_issueTagger` as one-line
  delegations; update the default `issueTaggerFactory` to take the bundle;
  delete the inline `RepoContext`/client builders.
- `core/spec/lib/context/RepoContextFactory_spec.js` — new; unit spec above.
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — only if an existing
  assertion depends on `issueTaggerFactory`'s argument shape.
