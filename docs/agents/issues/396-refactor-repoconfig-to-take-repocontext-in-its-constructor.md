# Issue: Refactor RepoConfig to take repoContext in its constructor

## Description

`RepoConfig` (`core/lib/utils/config/RepoConfig.js`) exposes 2 public methods —
`getSafeBranch(repoPath)`, `getIgnoredCheckPatterns(repoPath)` — each taking `repoPath` as
an explicit argument. It has no constructor today. Both of its production callers,
`commands/shared/SafeBranch.js` and `commands/auto-fix-all/AutoFixAllWaitCi.js`, already
take a `repoContext` (`core/lib/context/RepoContext.js`) in their own constructor and
default-construct a zero-arg `RepoConfig` as a `deps` collaborator (`repoConfig = new
RepoConfig()`), passing `repoContext.repoPath` explicitly into each call instead of letting
`RepoConfig` read it off the context they already hold.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `RepoConfig` still uses the older per-method-argument shape, which
repeats `repoContext.repoPath` at every call site in both its callers and leaks the
context's internal shape into them.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext`, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use).

### Phase 1: Accept repoContext in the constructor

- Add a constructor to `RepoConfig` storing an optional `repoContext`.
- Both methods (`getSafeBranch`, `getIgnoredCheckPatterns`) keep their `repoPath` parameter
  but fall back to the constructor-injected `repoContext.repoPath` when `repoPath` isn't
  passed explicitly — both calling styles work during the transition.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `SafeBranch.js` and `AutoFixAllWaitCi.js` to construct
  `new RepoConfig(this._repoContext)` (instead of `new RepoConfig()`) and stop passing
  `repoContext.repoPath` to each `getSafeBranch`/`getIgnoredCheckPatterns` call.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from both methods; `repoContext`
  becomes the only source of `repoPath`, required at construction.
- Update JSDoc (drop the repeated `@param {string} repoPath ...`).
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Done when

- `RepoConfig` takes `repoContext` at construction; neither public method takes `repoPath`
  as an argument.
- `SafeBranch.js` and `AutoFixAllWaitCi.js` pass `repoContext` at construction instead of
  `repoPath` per call.
- `RepoConfig`'s spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`, `ConfigChain.js`,
  and `IssueFile.js`, each carrying the same idea for its own file.

## Benefits

- `RepoConfig` is more encapsulated — `repoPath` threading stops at construction, matching
  `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoContext.repoPath` unpacking at every call site in
  `SafeBranch.js` and `AutoFixAllWaitCi.js`.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
