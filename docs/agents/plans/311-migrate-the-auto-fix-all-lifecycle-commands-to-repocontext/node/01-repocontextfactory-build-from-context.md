# Add RepoContextFactory.buildFromContext

`RepoContextFactory.build(repoPath)` builds a fresh `RepoContext` **and** the
context-bound clients off it. `AutoFixAllWaitCi` (Step 5) will hold a
ready-made `RepoContext` injected by `Dispatcher` and still needs the full
bundle (`PrOperations`/`PrChecker` consume `context` + `gitClient`/`gitBranch`/
`git`/`githubClient`). Add a path that takes an existing `RepoContext` and
wraps the clients around *that* instance rather than constructing a second one.

## What to do

- Add `buildFromContext(context)` returning the same flat six-key bundle
  (`{ context, gitClient, gitBranch, git, githubClient, issueClient }`) that
  `build` returns, but with `context` being the passed-in instance verbatim.
  The five clients are built exactly as in `build` today, using the factory's
  `execFileAsync` / `fetchFn` / `timeoutMs`.
- Refactor `build(repoPath)` to delegate: construct the `RepoContext` (with the
  factory's `origin`/`githubToken`/`issueStateService`/`configChain` as it does
  now) and hand it to `buildFromContext`. Keeps one place assembling the
  clients.
- `build`'s existing contract is unchanged — `build(REPO_PATH).context` is still
  a distinct `RepoContext` per call bound to `REPO_PATH`.
- JSDoc both methods. Note in `buildFromContext`'s doc that `origin`/
  `githubToken`/`issueStateService`/`configChain` come from the passed
  `context`, so the factory's own copies of those are not consulted on this
  path (only `execFileAsync`/`fetchFn`/`timeoutMs` are).

## Tests

Add to `core/spec/lib/context/RepoContextFactory_spec.js` a `#buildFromContext`
describe:

- returns the flat bundle with all six keys.
- `bundle.context` is the **same** instance that was passed in
  (`expect(bundle.context).toBe(inputContext)`).
- forwards the injected `execFileAsync` into the returned `gitClient` (mirror
  the existing `#build` test).
- forwards the injected `fetchFn` into both `githubClient` and `issueClient`
  (mirror the existing `#build` test).
- keep/adjust an assertion that `#build` still returns a **distinct**
  `RepoContext` per call (it now goes through `buildFromContext` internally, so
  confirm the delegation didn't change that).

## Files to Change

- `core/lib/context/RepoContextFactory.js` — add `buildFromContext(context)`;
  refactor `build(repoPath)` to delegate to it.
- `core/spec/lib/context/RepoContextFactory_spec.js` — add `#buildFromContext`
  coverage; confirm `#build`'s per-call-distinct-context behavior still holds.
