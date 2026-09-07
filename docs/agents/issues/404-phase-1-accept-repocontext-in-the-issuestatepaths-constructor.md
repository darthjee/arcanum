# Issue: Phase 1: Accept repoContext in the IssueStatePaths constructor

## Description

Phase 1 of the phased migration in #397. `IssueStatePaths`
(`core/lib/utils/file/IssueStatePaths.js`) exposes one public method, `paths(repoPath,
id)`, and has no constructor today. This sub-issue adds constructor-injectable
`repoContext` support without changing any caller, following the dual-mode precedent
established in `core/lib/commands/shared/GithubIssue.js` and refined in
`core/lib/utils/config/ConfigChain.js` (#401), whose "explicit `repoPath` argument wins
over the injected `repoContext`" fallback semantics this change matches exactly.

## Problem

`repoContext` exists so callers stop threading `repoPath` through every method call. Before
the three callers can be migrated (Phase 2, the next sub-issue), `IssueStatePaths` needs to
accept a `repoContext` at construction while still supporting the current per-call
`repoPath` style during the transition.

## Solution

- Add a `constructor({ repoContext } = {})` to `IssueStatePaths`, storing the optional
  `repoContext` as `this._repoContext`. Use the destructured deps-object shape (matching
  `ConfigChain` from #401 and the DI convention across `core/lib/utils/`), not a bare
  positional parameter — `IssueStatePaths` has no other collaborators today, but the
  deps-object form keeps it consistent and open for extension.
- `paths(repoPath, id)` keeps its `repoPath` parameter but resolves the effective base as
  `repoPath ?? this._repoContext?.repoPath`, so an explicitly passed `repoPath` always
  wins and the current per-call style keeps working unchanged. (Unlike `GithubIssue.js`'s
  `#info`/`#create`, which unconditionally overwrite `repoPath` for their CLI entrypoint —
  that behaviour is deliberately not copied here.)
- Spec (`core/spec/lib/utils/file/IssueStatePaths_spec.js`): add coverage that constructs
  with a `repoContext` and omits `repoPath` per call, reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Also cover that an explicit
  `repoPath` argument overrides the injected `repoContext.repoPath`. The existing
  per-call-`repoPath` spec cases are untouched.

### Done when

- `IssueStatePaths` has a `constructor({ repoContext } = {})` storing the optional
  `repoContext`.
- `paths()` resolves the base path from its `repoPath` argument when passed, otherwise from
  `repoContext.repoPath`.
- The spec covers both construction styles and the explicit-argument-wins precedence.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Migrating the call sites (`IssueStateService.js`, `IssueState.js`, `GithubIssue.js`) —
  Phase 2.
- Removing the `repoPath` parameter or the fallback — Phase 3.

## Benefits

- Unblocks the Phase 2 call-site migration.
- No behaviour change for existing callers.

Owning agent: `node`.
