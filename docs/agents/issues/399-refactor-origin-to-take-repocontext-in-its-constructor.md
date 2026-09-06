# Issue: Refactor Origin to take repoContext in its constructor

## Description

`Origin` (`core/lib/utils/git/Origin.js`) exposes 2 public methods —
`resolve(repoPath)`, `resolveWithRef(repoPath)` — each taking `repoPath` as an explicit
argument. Its constructor today only accepts `{ execFileAsync }`. It's used two ways: as a
zero-arg internal collaborator built directly by `context/RepoContext.js` and
`context/RepoContextFactory.js` (`origin = new Origin()`, before a `RepoContext` exists to
inject), and as a zero-arg `deps` collaborator in `commands/shared/GithubIssue.js`, which
already takes `repoContext` in its own constructor and passes `repoContext.repoPath`
explicitly into `resolve`/`resolveWithRef` instead of letting `Origin` read it off the
context `GithubIssue` already holds.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `Origin` still uses the older per-method-argument shape at its
`GithubIssue.js` call site, repeating `repoContext.repoPath` there and leaking the
context's internal shape into it.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` itself (constructor-injectable `repoContext`, with
a zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use). This
dual mode is structurally required for `Origin`: `RepoContext`/`RepoContextFactory` must
keep being able to build it zero-arg, since no `RepoContext` exists yet at that point.

### Phase 1: Accept repoContext in the constructor

- Extend `Origin`'s constructor to also accept an optional `repoContext` alongside the
  existing `execFileAsync` dep.
- Both methods (`resolve`, `resolveWithRef`) keep their `repoPath` parameter but fall back
  to the constructor-injected `repoContext.repoPath` when `repoPath` isn't passed
  explicitly — both calling styles work during the transition, and `RepoContext`/
  `RepoContextFactory`'s zero-arg internal construction keeps working unchanged.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `GithubIssue.js` to construct `new Origin({ repoContext: this._repoContext })`
  (instead of `new Origin()`) and stop passing `repoContext.repoPath` to `resolve`/
  `resolveWithRef` — only when `GithubIssue` itself was constructed with a `repoContext`
  (its own zero-arg internal-collaborator path is unaffected).

### Phase 3: Remove repoPath from method arguments — internal-use call sites only

- `RepoContext.js`/`RepoContextFactory.js`'s zero-arg internal use of `Origin` must keep
  working, so `resolve`/`resolveWithRef` cannot drop the `repoPath` parameter outright the
  way a single-caller class like `QueueStore` can. This phase's scope needs re-deciding when
  this issue gets split — options include leaving `repoPath` as a permanent optional
  override on `Origin`, or having `RepoContext` construct its own `Origin` with itself as
  `repoContext` once it exists (mirroring how `RepoContext` already does this for
  `IssueStateService`).
- Update JSDoc, and `GithubIssue.js`'s spec, accordingly once the above is settled.

### Done when

- `Origin` accepts `repoContext` at construction and `GithubIssue.js` uses it instead of
  passing `repoPath` per call.
- `RepoContext`/`RepoContextFactory`'s existing zero-arg internal construction of `Origin`
  is unaffected.
- `Origin`'s spec covers both the `repoContext`-constructed and legacy `repoPath`-per-call
  paths.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `GithubToken.js`,
  `ConfigChain.js`, and `IssueFile.js`, each carrying the same idea for its own file.
- Resolving whether `Origin`'s zero-arg internal-use path can ever fully drop `repoPath` —
  deferred to Phase 3, to be decided when this issue is split.

## Benefits

- `Origin` is more encapsulated for its `GithubIssue.js` use — `repoPath` threading stops at
  construction there, matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, and
  `GithubIssue` itself.
- Removes the repeated `repoContext.repoPath` unpacking at that call site.
- Consistent constructor shape across the codebase's repo-scoped collaborators, without
  breaking `RepoContext`/`RepoContextFactory`'s bootstrap-time zero-arg construction.
