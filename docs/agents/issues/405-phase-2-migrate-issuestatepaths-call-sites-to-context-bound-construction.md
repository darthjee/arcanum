# Issue: Phase 2: Migrate IssueStatePaths call sites to context-bound construction

## Description

Phase 2 of the phased migration in #397, following Phase 1 (#404, merged as `69b72b9`),
which added the options-bag constructor `new IssueStatePaths({ repoContext })` and a
`repoPath ?? this._repoContext?.repoPath` fallback inside `paths(repoPath, id)`. This
sub-issue updates the three callers to construct `IssueStatePaths` with a context and stop
passing `repoPath` explicitly into `paths()` (i.e. call `paths(undefined, id)`, relying on
the Phase-1 fallback). The `paths()` signature itself is unchanged here — collapsing it to
`paths(id)` is Phase 3 (#406).

## Problem

All three callers already hold a context-like object but still pass `repoPath` into every
`paths()` call:

- `core/lib/services/IssueStateService.js` — constructor takes a `{ context }` options bag
  and stores `this._context`; its default collaborator is `issueStatePaths = new
  IssueStatePaths()` (zero-arg). Three methods call
  `this._issueStatePaths.paths(this._context.repoPath, id)` (`get`, and two more around
  lines 146 and 169).
- `core/lib/commands/shared/IssueState.js` — constructor takes a positional `repoContext`
  (stored as `this._repoContext`), default `issueStatePaths = new IssueStatePaths()`.
  `run()` destructures `repoPath` off `this._repoContext` for the usage-message validation
  check and also calls `this._issueStatePaths.paths(repoPath, id)`.
- `core/lib/commands/shared/GithubIssue.js` — constructor takes a positional `repoContext`
  (stored as `this._repoContext`), default `issueStatePaths = new IssueStatePaths()`. It
  holds one `this._issueStatePaths` and forwards that same instance into every per-call
  `IssueStateService` built by `_issueStateService(repoPath)` (which also builds a fresh
  per-call `new RepoContext({ repoPath })` as that service's `context`).

## Solution

Construct each context-bound `IssueStatePaths` in the deps destructuring default (matching
the one-line-per-collaborator idiom the recent QueueStore / RepoConfig / GithubToken
refactors used), and switch every `paths()` call to `paths(undefined, id)`.

- `IssueStateService.js`: default becomes `issueStatePaths = new IssueStatePaths({
  repoContext: context })` (`context` is destructured before `issueStatePaths`, so it is in
  scope — destructuring defaults evaluate left to right). Drop the explicit
  `this._context.repoPath` from all three `paths()` calls.
- `IssueState.js`: default becomes `issueStatePaths = new IssueStatePaths({ repoContext })`
  (the positional `repoContext` param is in scope for the options-param defaults). Drop the
  explicit `repoPath` from its `paths()` call. The `repoPath` local in `run()` stays — it
  is still needed for the usage-message validation check.
- `GithubIssue.js`: default becomes `issueStatePaths = new IssueStatePaths({ repoContext })`,
  bound to `GithubIssue`'s own constructor `repoContext`. Keep forwarding that single
  instance into each per-call `IssueStateService` unchanged. Consequence: once
  `IssueStateService` stops passing `repoPath`, the forwarded instance resolves `repoPath`
  from `GithubIssue`'s constructor `repoContext`, not from the per-call `RepoContext({
  repoPath })` that `_issueStateService()` builds. In practice `fetch(repoPath, id)` is
  always called with the same `repoPath` that `GithubIssue`'s `repoContext` was built from,
  so the resolved path is identical.
- Keep the Phase-1 fallback in `paths()` in place — this change stays backward-compatible.
- Update specs for the callers so they still pass — notably `IssueState_spec.js`'s
  `pathsSpy` assertion (`toHaveBeenCalledWith(repoPath, '42')` becomes
  `toHaveBeenCalledWith(undefined, '42')`), plus any `paths()` call assertions in the
  `IssueStateService` specs. `GithubIssue`'s specs do not inject `issueStatePaths` and
  should need no change beyond staying green.

### Done when

- `IssueStateService.js`, `IssueState.js`, and `GithubIssue.js` all construct
  `IssueStatePaths` with `{ repoContext }` in the deps default and call `paths(undefined,
  id)` — no caller passes a real `repoPath` into `paths()` any more.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Removing the `repoPath` parameter or the Phase-1 fallback from `paths()`, and updating its
  JSDoc — Phase 3 (#406).
- Any change to `GithubIssue#fetch(repoPath, id)` / `_issueStateService(repoPath)`
  signatures, or to `GithubIssue`'s single-shared-instance forwarding pattern — the
  per-call `repoPath` threading there is a separate concern (Origin / #399).

## Benefits

- Removes the repeated `repoPath` passing at every call site across three callers.
- Unblocks the Phase 3 cleanup (#406).

Owning agent: `node`.
