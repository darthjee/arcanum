# Issue: Refactor IssueFile to take repoContext in its constructor

## Description

`IssueFile` (`core/lib/utils/file/IssueFile.js`) exposes its lookup logic as a **static**
method, `static async findExisting(repoPath, issuesFolder, id)`, taking `repoPath` as an
explicit argument (its sibling `static titleFromFilename(filename)` doesn't take
`repoPath`). Unlike the other repoContext-migration candidates, `IssueFile` has no
constructor or instances at all today — it's called directly as `IssueFile.findExisting(
repoPath, issuesFolder, id)` from three call sites: `commands/shared/ResolveAndFetch.js`,
`commands/shared/ResolvePlanPaths.js`, and `commands/shared/ResolveIdAndFile.js`.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `IssueFile` still uses the older per-call-argument shape, and — being
static — can't hold a constructor-injected `repoContext` at all without first becoming an
instantiable class. This is a different-shaped change from the other repoContext-migration
issues in this batch.

## Solution

### Phase 0: Convert from static to instance

- Turn `IssueFile` into an instantiable class: `findExisting` becomes an instance method
  (`async findExisting(repoPath, issuesFolder, id)` on `new IssueFile()`), keeping
  `titleFromFilename` static (it never needed `repoPath`) or converting it too for
  consistency — to be decided when this issue is split.
- Update `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and `ResolveIdAndFile.js` to
  instantiate `new IssueFile()` and call the instance method, with no behavior change yet.

### Phase 1: Accept repoContext in the constructor

- Extend the new constructor to also accept an optional `repoContext`.
- `findExisting(repoPath, issuesFolder, id)` keeps its `repoPath` parameter but falls back
  to the constructor-injected `repoContext.repoPath` when `repoPath` isn't passed
  explicitly — both calling styles work during the transition.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and `ResolveIdAndFile.js` — all three
  already resolve/hold a `repoContext` at their own layer — to construct
  `new IssueFile(repoContext)` and stop passing `repoPath` explicitly to `findExisting`.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from `findExisting`; `repoContext`
  becomes the only source of `repoPath`, required at construction.
- Update JSDoc (drop the repeated `@param {string} repoPath ...`).
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Done when

- `IssueFile` is an instantiable class taking `repoContext` at construction; `findExisting`
  no longer takes `repoPath` as an argument.
- `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and `ResolveIdAndFile.js` all pass
  `repoContext` at construction instead of `repoPath` per call.
- `IssueFile`'s spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`,
  and `ConfigChain.js`, each carrying the same idea for its own file (none of which need
  this issue's Phase 0 static-to-instance conversion).

## Benefits

- `IssueFile` is more encapsulated — `repoPath` threading stops at construction, matching
  `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoPath` passing at all three call sites.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
