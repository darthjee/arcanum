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
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext` as an
optional leading positional, alongside a `{ ...deps } = {}` object, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use). The
final constructor shape is `constructor(repoContext, { execFileAsync } = {})` — `repoContext`
positional, `execFileAsync` staying in the deps object — matching `GithubIssue.js` rather
than folding everything into a single options object. `BranchCleanup` is **not** split into
sub-issues; the three phases below land as three PRs against this one issue.

### Phase 1: Accept repoContext in the constructor

- Change the constructor from `constructor({ execFileAsync = defaultExecFileAsync } = {})` to
  `constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {})`, storing
  `this._repoContext = repoContext`. `repoContext` is optional on this phase.
- `cleanupBranch(repoPath, id)` keeps its `repoPath` parameter but falls back to
  `this._repoContext?.repoPath` when `repoPath` isn't passed explicitly — both calling
  styles work during the transition. The `if (!repoPath || !id)` guard still applies to the
  effective (post-fallback) `repoPath`.
- Spec (`core/spec/lib/utils/git/BranchCleanup_spec.js`): the shared builder currently does
  `new BranchCleanup({ execFileAsync: fakeExecFileAsync(), ...overrides })`; extend it to
  also pass an optional positional `repoContext`. Add coverage that constructs with a
  `repoContext` and omits `repoPath` per call, reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.
- No call-site changes.

### Phase 2: Migrate the call site

- Update `AutoFixAllGithub.js`. Note `branchCleanup = new BranchCleanup()` currently sits in
  a **default parameter**, which cannot reference `this._repoContext`; move construction into
  the constructor body. Change the deps entry to `branchCleanup` (no default) and set
  `this._branchCleanup = branchCleanup ?? new BranchCleanup(this._repoContext)` after
  `this._repoContext` is assigned.
- Change `cleanupBranch(id)` (the `AutoFixAllGithub` method at
  `AutoFixAllGithub.js:143`) to call `this._branchCleanup.cleanupBranch(id)` — drop the
  `this._repoContext.repoPath` argument.
- Update the `@param {BranchCleanup} [deps.branchCleanup]` JSDoc note if its wording implies
  a pre-built default.
- Depends on Phase 1.

### Phase 3: Remove repoPath from method arguments

- Drop the `repoPath` parameter and the Phase-1 fallback from `cleanupBranch`; it becomes
  `cleanupBranch(id)` and reads `this._repoContext.repoPath` as the only source. `repoContext`
  is now required at construction.
- Replace the `if (!repoPath || !id)` guard with an `id`-only check (plus, optionally, a
  guard that `this._repoContext?.repoPath` is present). The `Usage: github.sh cleanup-branch
  <repo_path> <id>` error string stays as-is — it names the shell command this mirrors, whose
  own signature is unchanged.
- Update JSDoc: drop the `@param {string} repoPath ...` line on `cleanupBranch`; document
  `repoContext` on the constructor.
- Spec: drop the now-invalid per-call-`repoPath` test cases (the positional-`REPO_PATH`
  calls, and the "rejects when repoPath or id is missing" case becomes "rejects when id is
  missing"); only `repoContext`-based construction via `createRepoContextMock` remains.
- Depends on Phases 1 and 2.

### Done when

- `BranchCleanup`'s constructor is `constructor(repoContext, { execFileAsync } = {})` with
  `repoContext` required; `cleanupBranch` no longer takes `repoPath` as an argument.
- `AutoFixAllGithub.js` builds `new BranchCleanup(this._repoContext)` in its constructor body
  and calls `cleanupBranch(id)` without `repoContext.repoPath`.
- `BranchCleanup`'s spec uses `createRepoContextMock` instead of a raw path.
- `make core-test` passes; `make core-lint` is clean — on each phase's PR independently.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `RepoConfig.js`,
  `IssueStatePaths.js`, `Origin.js`, `GithubToken.js`, `ConfigChain.js`, and `IssueFile.js`,
  each carrying the same idea for its own file. (`QueueStore.js`, issue #395, has already
  landed — though as a single clean-break PR rather than a phased migration.)

## Benefits

- `BranchCleanup` is more encapsulated — `repoPath` threading stops at construction,
  matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, and `GithubIssue`.
- Removes the repeated `repoContext.repoPath` unpacking at the call site in
  `AutoFixAllGithub.js`.
- Consistent constructor shape across the codebase's repo-scoped collaborators.
