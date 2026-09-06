# Issue: Refactor BranchCleanup to take repoContext in its constructor

## Description

`BranchCleanup` (`core/lib/utils/git/BranchCleanup.js`) exposes 1 public method —
`cleanupBranch(repoPath, id)` — taking `repoPath` as an explicit argument. Its constructor
today only accepts `{ execFileAsync }`. Its only production caller,
`commands/auto-fix-all/AutoFixAllGithub.js`, already takes a `repoContext`
(`core/lib/context/RepoContext.js`) in its own constructor and default-constructs a
zero-arg `BranchCleanup` as a `deps` collaborator (`branchCleanup = new BranchCleanup()`),
passing `repoContext.repoPath` explicitly into `cleanupBranch` instead of letting
`BranchCleanup` read it off the context its caller already holds.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `BranchCleanup` still uses the older per-method-argument shape, which
repeats `repoContext.repoPath` at its call site in `AutoFixAllGithub.js` and leaks the
context's internal shape into it.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext`, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use).

### Phase 1: Accept repoContext in the constructor

- Extend `BranchCleanup`'s constructor to also accept an optional `repoContext` alongside
  the existing `execFileAsync` dep.
- `cleanupBranch(repoPath, id)` keeps its `repoPath` parameter but falls back to the
  constructor-injected `repoContext.repoPath` when `repoPath` isn't passed explicitly —
  both calling styles work during the transition.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `AutoFixAllGithub.js` to construct
  `new BranchCleanup({ repoContext: this._repoContext })` (instead of `new
  BranchCleanup()`) and stop passing `repoContext.repoPath` to `cleanupBranch`.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from `cleanupBranch`; `repoContext`
  becomes the only source of `repoPath`, required at construction.
- Update JSDoc (drop the repeated `@param {string} repoPath ...`).
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Done when

- `BranchCleanup` takes `repoContext` at construction; `cleanupBranch` no longer takes
  `repoPath` as an argument.
- `AutoFixAllGithub.js` passes `repoContext` at construction instead of `repoPath` per call.
- `BranchCleanup`'s spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `Origin.js`, `GithubToken.js`, `ConfigChain.js`, and
  `IssueFile.js`, each carrying the same idea for its own file.

## Benefits

- `BranchCleanup` is more encapsulated — `repoPath` threading stops at construction,
  matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoContext.repoPath` unpacking at the call site in
  `AutoFixAllGithub.js`.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
