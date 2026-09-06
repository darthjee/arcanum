# Issue: Refactor ConfigChain to take repoContext in its constructor

## Description

`ConfigChain` (`core/lib/utils/config/ConfigChain.js`) exposes 1 public method —
`read(repoPath, namespace, ...keys)` — taking `repoPath` as an explicit argument. Its
constructor today only accepts `{ env }`. Its only caller today is
`context/RepoContext.js`, which builds it as a zero-arg internal collaborator (`configChain
= new ConfigChain()`, before a `RepoContext` exists to inject) and calls `read` with
`this.repoPath` explicitly.

## Problem

`repoContext` exists precisely so callers stop threading `repoPath` through every method
call individually. `ConfigChain` still uses the older per-method-argument shape. Unlike
`QueueStore`/`RepoConfig`/etc., it has no *external* caller yet that already holds a
`repoContext` at its own layer — today it's purely a `RepoContext`-internal collaborator —
so the payoff is smaller right now, but the same encapsulation is still worth applying for
consistency and to be ready if/when another caller needs `ConfigChain` directly (the same
way `GithubIssue.js` reaches for `Origin`/`GithubToken` directly today).

## Solution

Phased, backward-compatible migration — mirrors the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js` (constructor-injectable `repoContext`, with a
zero-arg/per-method-`repoPath` fallback for internal `RepoContext`-collaborator use). This
dual mode is structurally required here too: `RepoContext` must keep being able to build
`ConfigChain` zero-arg, since no `RepoContext` exists yet at that point.

### Phase 1: Accept repoContext in the constructor

- Extend `ConfigChain`'s constructor to also accept an optional `repoContext` alongside the
  existing `env` dep.
- `read(repoPath, namespace, ...keys)` keeps its `repoPath` parameter but falls back to the
  constructor-injected `repoContext.repoPath` when `repoPath` isn't passed explicitly —
  both calling styles work during the transition, and `RepoContext`'s zero-arg internal
  construction keeps working unchanged.
- Spec: add coverage that constructs with a `repoContext` and omits `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` spec
  cases are untouched.

### Phase 2: Migrate call sites

- No external call site to migrate today beyond `RepoContext.js` itself, which stays on the
  zero-arg internal path (see Phase 3). If a future caller needs `ConfigChain` directly
  (the way `GithubIssue.js` reaches for `Origin`/`GithubToken`), it should construct
  `new ConfigChain({ repoContext })` and rely on Phase 1's fallback rather than passing
  `repoPath` per call.

### Phase 3: Remove repoPath from method arguments — open question

- `RepoContext.js`'s zero-arg internal use of `ConfigChain` must keep working, so `read`
  cannot drop the `repoPath` parameter outright the way a single-external-caller class like
  `QueueStore` can. This phase's scope needs re-deciding when this issue gets split — same
  open question as the companion `Origin.js`/`GithubToken.js` issues.
- Update JSDoc accordingly once the above is settled.

### Done when

- `ConfigChain` accepts `repoContext` at construction, with the fallback in place.
- `RepoContext.js`'s existing zero-arg internal construction of `ConfigChain` is unaffected.
- `ConfigChain`'s spec covers both the `repoContext`-constructed and legacy
  `repoPath`-per-call paths.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `Origin.js`, `GithubToken.js`,
  and `IssueFile.js`, each carrying the same idea for its own file.
- Resolving whether `ConfigChain`'s zero-arg internal-use path can ever fully drop
  `repoPath` — deferred to Phase 3, to be decided when this issue is split.

## Benefits

- `ConfigChain` gains the same constructor shape as its sibling collaborators ahead of any
  future direct caller needing it, matching `AutoFixAllQueue`, `GitClient`,
  `PrOperations`, and `GithubIssue`.
- Consistent constructor shape across the codebase's repo-scoped collaborators, without
  breaking `RepoContext`'s bootstrap-time zero-arg construction.
