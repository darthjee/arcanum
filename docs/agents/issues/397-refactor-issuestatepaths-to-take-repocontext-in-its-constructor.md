# Issue: Refactor IssueStatePaths to take repoContext in its constructor

## Description

`IssueStatePaths` (`core/lib/utils/file/IssueStatePaths.js`) exposes 1 public method —
`paths(repoPath, id)` — taking `repoPath` as an explicit argument. It has no constructor
today. It's used as a `deps` collaborator (zero-arg default `issueStatePaths = new
IssueStatePaths()`) by three callers: `services/IssueStateService.js` (itself already
`{context}`-bound — its own constructor takes `context` and forwards it to other
collaborators, proving the same nesting already works), `commands/shared/IssueState.js`,
and `commands/shared/GithubIssue.js` (both of which already take `repoContext` in their own
constructor).

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `IssueStatePaths` still uses the older per-method-argument shape — all
three callers already hold a context-like object (`repoContext` or `IssueStateService`'s own
`context`) but still pass `repoPath` explicitly into `paths()`.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext`, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use).

### Phase 1: Accept repoContext in the constructor

- Add a constructor to `IssueStatePaths` storing an optional `repoContext`.
- `paths(repoPath, id)` keeps its `repoPath` parameter but falls back to the
  constructor-injected `repoContext.repoPath` when `repoPath` isn't passed explicitly —
  both calling styles work during the transition.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `IssueStateService.js` to construct its internal `IssueStatePaths` with its own
  `this._context` instead of zero-arg, and stop passing `repoPath` explicitly.
- Update `IssueState.js` and `GithubIssue.js` to construct
  `new IssueStatePaths(this._repoContext)` and stop passing `repoPath` explicitly.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from `paths()`; `repoContext`
  becomes the only source of `repoPath`, required at construction.
- Update JSDoc (drop the repeated `@param {string} repoPath ...`).
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Done when

- `IssueStatePaths` takes `repoContext` at construction; `paths()` no longer takes
  `repoPath` as an argument.
- `IssueStateService.js`, `IssueState.js`, and `GithubIssue.js` all pass a context object at
  construction instead of `repoPath` per call.
- `IssueStatePaths`'s spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`, `ConfigChain.js`, and
  `IssueFile.js`, each carrying the same idea for its own file.

## Benefits

- `IssueStatePaths` is more encapsulated — `repoPath` threading stops at construction,
  matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, `GithubIssue`, and
  `IssueStateService`'s own context-bound convention.
- Removes the repeated `repoPath` passing at every call site across three callers.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
