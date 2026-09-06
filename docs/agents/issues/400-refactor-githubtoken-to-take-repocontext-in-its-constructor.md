# Issue: Refactor GithubToken to take repoContext in its constructor

## Description

`GithubToken` (`core/lib/utils/github/GithubToken.js`) exposes 1 public method —
`get(repoPath)` — taking `repoPath` as an explicit argument. Its constructor today only
accepts `{ execFileAsync }`. It's used two ways: as a zero-arg internal collaborator built
directly by `context/RepoContext.js` and `context/RepoContextFactory.js` (`githubToken =
new GithubToken()`, before a `RepoContext` exists to inject), and as a zero-arg `deps`
collaborator in `commands/shared/GithubIssue.js`, which already takes `repoContext` in its
own constructor and passes `repoContext.repoPath` explicitly into `get` instead of letting
`GithubToken` read it off the context `GithubIssue` already holds.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `GithubToken` still uses the older per-method-argument shape at its
`GithubIssue.js` call site, repeating `repoContext.repoPath` there and leaking the
context's internal shape into it.

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` itself (constructor-injectable `repoContext`, with
a zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use). This
dual mode is structurally required for `GithubToken`: `RepoContext`/`RepoContextFactory`
must keep being able to build it zero-arg, since no `RepoContext` exists yet at that point
— the same situation as the companion `Origin.js` issue.

### Phase 1: Accept repoContext in the constructor

- Extend `GithubToken`'s constructor to also accept an optional `repoContext` alongside the
  existing `execFileAsync` dep.
- `get(repoPath)` keeps its `repoPath` parameter but falls back to the constructor-injected
  `repoContext.repoPath` when `repoPath` isn't passed explicitly — both calling styles work
  during the transition, and `RepoContext`/`RepoContextFactory`'s zero-arg internal
  construction keeps working unchanged.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- Update `GithubIssue.js` to construct `new GithubToken({ repoContext: this._repoContext
  })` (instead of `new GithubToken()`) and stop passing `repoContext.repoPath` to `get` —
  only when `GithubIssue` itself was constructed with a `repoContext` (its own zero-arg
  internal-collaborator path is unaffected).

### Phase 3: Remove repoPath from method arguments — internal-use call sites only

- `RepoContext.js`/`RepoContextFactory.js`'s zero-arg internal use of `GithubToken` must
  keep working, so `get` cannot drop the `repoPath` parameter outright the way a
  single-caller class like `QueueStore` can. This phase's scope needs re-deciding when this
  issue gets split — same open question as the companion `Origin.js` issue (leave
  `repoPath` as a permanent optional override, or have `RepoContext` construct its own
  `GithubToken` with itself as `repoContext` once it exists).
- Update JSDoc, and `GithubIssue.js`'s spec, accordingly once the above is settled.

### Done when

- `GithubToken` accepts `repoContext` at construction and `GithubIssue.js` uses it instead
  of passing `repoPath` per call.
- `RepoContext`/`RepoContextFactory`'s existing zero-arg internal construction of
  `GithubToken` is unaffected.
- `GithubToken`'s spec covers both the `repoContext`-constructed and legacy
  `repoPath`-per-call paths.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `ConfigChain.js`,
  and `IssueFile.js`, each carrying the same idea for its own file.
- Resolving whether `GithubToken`'s zero-arg internal-use path can ever fully drop
  `repoPath` — deferred to Phase 3, to be decided when this issue is split.

## Benefits

- `GithubToken` is more encapsulated for its `GithubIssue.js` use — `repoPath` threading
  stops at construction there, matching `AutoFixAllQueue`, `GitClient`, `PrOperations`, and
  `GithubIssue` itself.
- Removes the repeated `repoContext.repoPath` unpacking at that call site.
- Consistent constructor shape across the codebase's repo-scoped collaborators, without
  breaking `RepoContext`/`RepoContextFactory`'s bootstrap-time zero-arg construction.
