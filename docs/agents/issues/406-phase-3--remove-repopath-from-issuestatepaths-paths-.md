# Issue: Phase 3: Remove repoPath from IssueStatePaths#paths()

## Description

Phase 3 of the phased migration in #397 — the breaking cleanup that completes the issue.
Phase 2 (#405, "Migrate IssueStatePaths call sites to context-bound construction") has now
merged, so this phase is unblocked.

## Problem

After Phase 2, all three callers (`IssueStateService.js`, `IssueState.js`, `GithubIssue.js`)
already construct `IssueStatePaths` with a bound `repoContext`, but `paths()` still accepts an
explicit `repoPath` argument and every call site still passes it — as literal `undefined`, to
trigger the constructor-injected fallback. The Phase-1 fallback logic, the stale `repoPath`
JSDoc, and the now-redundant per-call spec cases are still present.

## Solution

- **`IssueStatePaths` (`core/lib/utils/file/IssueStatePaths.js`)**:
  - Change the constructor from `constructor({ repoContext } = {})` to a bare required
    positional `constructor(repoContext)` — converging on the same finished shape already
    documented on `RepoConfig`/`QueueStore` ("matching `GithubIssue.js`'s dual-mode
    collaborators once their own fallback is dropped").
  - Change `paths(repoPath, id)` to `paths(id)`: drop the `repoPath` parameter and the
    `repoPath ?? this._repoContext?.repoPath` fallback entirely — resolve `repoPath`
    unconditionally from `this._repoContext.repoPath`.
  - Update the JSDoc for both the constructor and `paths()` accordingly (drop the `@param
    {string} [repoPath]` entries; document `repoContext` as the sole, required source).

- **Call-site updates** (all three, required — not just the construction call already fixed
  in Phase 2):
  - `core/lib/services/IssueStateService.js`: line 37's default
    `new IssueStatePaths({ repoContext: context })` → `new IssueStatePaths(context)`; its 3
    `.paths(undefined, id)` calls (lines 58, 146, 169) → `.paths(id)`.
  - `core/lib/commands/shared/IssueState.js`: line 45's default
    `new IssueStatePaths({ repoContext })` → `new IssueStatePaths(repoContext)`; its
    `.paths(undefined, id)` call (line 83) → `.paths(id)`.
  - `core/lib/commands/shared/GithubIssue.js`: line 68's dead/unused deps-default
    `issueStatePaths = new IssueStatePaths()` (zero-arg — would throw once the constructor
    requires `repoContext`) → `new IssueStatePaths(repoContext)`; the per-call instance built
    in `_issueStateService()` (line 191) `new IssueStatePaths({ repoContext: context })` →
    `new IssueStatePaths(context)`.

- **Spec (`core/spec/lib/utils/file/IssueStatePaths_spec.js`)**: drop the two raw-`repoPath`
  test cases entirely (`paths('/repo', '42')` / `paths('/repo', '7')`) and the "prefers an
  explicit repoPath over the constructor-injected repoContext" case (that behavior no longer
  exists). Keep only the `repoContext`-constructed case, updated to call `.paths(id)` (no
  `repoPath` argument) via `createRepoContextMock`.

### Done when

- `IssueStatePaths` takes a required, bare `repoContext` at construction; `paths()` takes
  only `id` — no `repoPath` argument, no fallback.
- All 4 production call sites (`IssueStateService.js` x3, `IssueState.js` x1) call
  `.paths(id)` instead of `.paths(undefined, id)`, and all 3 construction sites
  (`IssueStateService.js`, `IssueState.js`, `GithubIssue.js` x2) pass `repoContext`
  positionally instead of `{ repoContext }`.
- `IssueStatePaths`'s spec only constructs via `createRepoContextMock`; no raw-`repoPath`
  cases remain.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues #395, #396, #398, #399,
  #400, #401, #402.
- `GithubIssue.js`'s own remaining per-method `repoPath` fallback (`.info()`/`.create()`) —
  a separate, larger cleanup than this issue's `IssueStatePaths`-only scope.

## Benefits

- `IssueStatePaths` is fully encapsulated — `repoPath` threading stops at construction,
  matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, `RepoConfig`, `QueueStore`,
  `GithubIssue`, and `IssueStateService`'s own context-bound convention.
- Consistent constructor shape (bare required `repoContext`, no deps-object wrapper) across
  the codebase's repo-scoped collaborators.
- Removes dead code: `GithubIssue.js`'s unused zero-arg `IssueStatePaths` deps-default, which
  would otherwise throw as soon as the constructor requires `repoContext`.

Owning agent: `node`.
