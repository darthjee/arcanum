# Issue: Refactor IssueFile to take repoContext in its constructor

## Description

`IssueFile` (`core/lib/utils/file/IssueFile.js`) exposes **both** its methods as
**static**: `static async findExisting(repoPath, issuesFolder, id)`, taking `repoPath` as
an explicit argument, and `static titleFromFilename(filePath)`, which needs no `repoPath`.
Unlike the other repoContext-migration candidates, `IssueFile` has no constructor or
instances at all today — it's called directly (`IssueFile.findExisting(...)`,
`IssueFile.titleFromFilename(...)`) from three call sites:
`commands/shared/ResolveAndFetch.js` (both methods), `commands/shared/ResolvePlanPaths.js`
(`findExisting` only), and `commands/shared/ResolveIdAndFile.js` (both methods). All three
already hold a `repoContext` (`core/lib/context/RepoContext.js`) in their own constructor.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `IssueFile` still uses the older per-call-argument shape and — being
static — can't hold a constructor-injected `repoContext` at all without first becoming an
instantiable class. This is a different-shaped change from the other repoContext-migration
issues in this batch, which all start from an already-instantiable class.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`GithubIssue.js` / `RepoConfig.js` / `BranchCleanup.js` (constructor-injected `repoContext`
with a per-method-`repoPath` fallback kept only for the transition), preceded by a
static-to-instance conversion this file uniquely needs and followed by a rename.

### Phase 0: Convert from static to instance

- Turn `IssueFile` into an instantiable class. **Both** methods become instance methods:
  `async findExisting(repoPath, issuesFolder, id)` and `titleFromFilename(filePath)` on
  `new IssueFile()`.
- `titleFromFilename` never took `repoPath` and gains no fallback in any later phase — its
  only change, here, is static → instance (for a uniform instance-method surface).
- Update `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and `ResolveIdAndFile.js` to
  instantiate `new IssueFile()` once and call the instance methods, with no behavior change
  yet.
- Spec: switch the `.findExisting` / `.titleFromFilename` describe blocks to instance-method
  (`#findExisting` / `#titleFromFilename`) form, constructing `new IssueFile()` per example.

### Phase 1: Accept repoContext in the constructor

- Extend the new constructor to accept an optional `repoContext`.
- `findExisting(repoPath, issuesFolder, id)` keeps its `repoPath` parameter but falls back
  to the constructor-injected `repoContext.repoPath` when `repoPath` isn't passed
  explicitly — both calling styles work during the transition. `titleFromFilename` is
  unaffected.
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
- Update JSDoc: drop the repeated `@param {string} repoPath ...`, add the
  `@param {RepoContext} repoContext` constructor line.
- Spec: drop the now-invalid per-call-`repoPath` test cases; only `repoContext`-based
  construction remains, via `createRepoContextMock`.

### Phase 4: Rename the class

- The class no longer holds a single file — it's a repoContext-bound issue-file
  lookup/derivation helper. Rename it to a name that reflects that (candidates:
  `IssueFileLocator`, `IssueFiles`, `IssueFileLookup` — the final name is chosen during
  planning).
- Rename the module file (`core/lib/utils/file/IssueFile.js` → the new name) and its spec
  (`core/spec/lib/utils/file/IssueFile_spec.js` → matching name).
- Update the imports in `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and
  `ResolveIdAndFile.js`, and the stale `IssueFile.js` doc reference in
  `core/lib/utils/file/IssueStatePaths.js`.

### Done when

- The class is instantiable, taking `repoContext` at construction; `findExisting` no longer
  takes `repoPath` as an argument, and `titleFromFilename` is an instance method.
- `ResolveAndFetch.js`, `ResolvePlanPaths.js`, and `ResolveIdAndFile.js` all construct it
  once with `repoContext` and call the instance methods, passing no `repoPath` per call.
- The class and its module/spec files are renamed away from `IssueFile`; every import and
  doc reference is updated.
- The spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`,
  and `ConfigChain.js`, each carrying the same idea for its own file (none of which need
  this issue's Phase 0 static-to-instance conversion or Phase 4 rename).

## Benefits

- The helper is more encapsulated — `repoPath` threading stops at construction, matching
  `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoPath` passing at all three call sites.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
- The class name finally matches what it does — a repo-scoped issue-file lookup helper, not
  a single file.
