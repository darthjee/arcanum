# Issue: Refactor QueueStore to take repoContext in its constructor

## Description

`QueueStore` (`core/lib/utils/queue/QueueStore.js`) exposes 4 public methods —
`read(repoPath)`, `write(repoPath, entries)`, `queueFile(repoPath)`, `lockFile(repoPath)` —
each taking `repoPath` as an explicit argument. It has no constructor today. Its only
production caller, `AutoFixAllQueue`
(`core/lib/commands/auto-fix-all/AutoFixAllQueue.js`), already holds a `repoContext`
(`core/lib/context/RepoContext.js`) at its own construction and currently unpacks
`this._repoContext.repoPath` to pass into every `QueueStore` call.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `QueueStore` still uses the older per-method-argument shape, which
repeats `this._repoContext.repoPath` at every call site inside `AutoFixAllQueue` and leaks
the context's internal shape into the caller.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext`, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use).

### Phase 1: Accept repoContext in the constructor

- Add a constructor to `QueueStore` storing an optional `repoContext`.
- Every method (`read`, `write`, `queueFile`, `lockFile`) keeps its `repoPath` parameter but
  falls back to the constructor-injected `repoContext.repoPath` when `repoPath` isn't
  passed explicitly — both calling styles work during the transition.
- Spec: add coverage in `core/spec/lib/utils/queue/QueueStore_spec.js` that constructs with
  a `repoContext` and omits `repoPath` per call, reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js` (already used by
  `AutoFixAllQueue_spec.js`). Existing per-call-`repoPath` spec cases (raw temp dir) are
  untouched.

### Phase 2: Migrate call sites

- Update `AutoFixAllQueue.js` to construct `new QueueStore(this._repoContext)` (instead of
  `new QueueStore()`) and stop passing `this._repoContext.repoPath` to each `read`/`write`/
  `queueFile`/`lockFile` call.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from all 4 methods; `repoContext`
  becomes the only source of `repoPath`, required at construction.
- Update JSDoc (drop the repeated `@param {string} repoPath ...`).
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Done when

- `QueueStore` takes `repoContext` at construction; none of its public methods take
  `repoPath` as an argument.
- `AutoFixAllQueue` passes `repoContext` at construction instead of `repoPath` per call.
- `QueueStore_spec.js` uses `createRepoContextMock` instead of a raw temp-dir path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `RepoConfig.js`,
  `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`, `ConfigChain.js`,
  and `IssueFile.js`, each carrying the same idea for its own file.

## Benefits

- `QueueStore` is more encapsulated — `repoPath` threading stops at construction, matching
  `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoContext.repoPath` unpacking at every call site in
  `AutoFixAllQueue`.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
