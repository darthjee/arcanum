# Node Plan: Phase 1: Accept repoContext in the IssueStatePaths constructor

Main plan: [plan.md](plan.md)

## Overview

Add constructor-injectable `repoContext` support to `IssueStatePaths` without touching any
caller, following the dual-mode precedent from `GithubIssue.js` and the "explicit argument
wins" fallback shape refined in `ConfigChain.js` (#401). The class currently has no
constructor and one public method, `paths(repoPath, id)`.

## Context

`repoContext` (`core/lib/context/RepoContext.js`) bundles a repo's `repoPath` with its
collaborators so callers stop threading `repoPath` through every method call. It exposes
`repoPath` as a public property (`this.repoPath`). `createRepoContextMock`
(`core/spec/support/factories/repoContextFactory.js`) builds a real `RepoContext` with a
`/fake/repo` default `repoPath`, wired to jasmine spies — the standard spec double for this
boundary.

The transitional dual-mode state this phase creates: constructor `repoContext` optional,
`paths()` still accepting an explicit `repoPath` with a fallback. Phase 2 migrates the
three call sites (`IssueStateService.js`, `IssueState.js`, `GithubIssue.js`); Phase 3
deletes the `repoPath` parameter and the fallback.

## Implementation Steps

### Step 1 — Add the constructor and the repoPath fallback

In `core/lib/utils/file/IssueStatePaths.js`:

- Add `constructor({ repoContext } = {})` storing `this._repoContext = repoContext`. Use
  the destructured deps-object shape (matching `ConfigChain` from #401 and the DI
  convention across `core/lib/utils/`), not a bare positional parameter — `IssueStatePaths`
  has no other collaborators today, but the deps-object form keeps it consistent and open
  for extension.
- In `paths(repoPath, id)`, resolve the effective base once at the top:
  `const base = repoPath ?? this._repoContext?.repoPath;` and use `base` in place of
  `repoPath` in the three `path.join` calls. Use `??` (not `||`) so only `undefined`/`null`
  triggers the fallback; an explicitly passed `repoPath` always wins.
- Update the JSDoc: document the new constructor param
  (`@param {import('../../context/RepoContext.js').default} [repoContext]`) and mark
  `paths()`'s `repoPath` as optional (`@param {string} [repoPath]`) with a note that it
  falls back to the constructor-injected `repoContext.repoPath`. Mirror the wording style
  of `ConfigChain.js`'s equivalent JSDoc.

Do **not** add error handling for the "neither `repoPath` nor `repoContext`" case — that
preserves the current implicit behaviour (`path.join(undefined, ...)` throws) and no caller
hits it.

### Step 2 — Add spec coverage for the constructor-injected path

In `core/spec/lib/utils/file/IssueStatePaths_spec.js`, keep the two existing
per-call-`repoPath` cases untouched and add:

- A context for construction with a `repoContext`: build
  `new IssueStatePaths({ repoContext: createRepoContextMock({ repoPath: '/repo' }) })`,
  call `.paths(undefined, '42')`, and assert the same `{ stateDir, stateFile, lockFile }`
  shape the existing case asserts (rooted at `/repo`).
- A case asserting explicit-argument precedence: construct with
  `createRepoContextMock({ repoPath: '/ctx-repo' })`, call `.paths('/arg-repo', '42')`, and
  assert the result is rooted at `/arg-repo`, not `/ctx-repo`.
- Import `createRepoContextMock` from `../../../support/factories/repoContextFactory.js`
  (three `../` from `spec/lib/utils/file/` to `spec/`, then `support/factories/...`).

## Files to Change

- `core/lib/utils/file/IssueStatePaths.js` — add `constructor({ repoContext } = {})`;
  `paths()` resolves `repoPath ?? this._repoContext?.repoPath`; JSDoc updated.
- `core/spec/lib/utils/file/IssueStatePaths_spec.js` — add coverage for
  `repoContext`-injected construction and for explicit-`repoPath` precedence; existing
  cases unchanged.

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test` in `core/`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint` in `core/`)

## Notes

- Out of scope for this phase: migrating the call sites (`IssueStateService.js`,
  `IssueState.js`, `GithubIssue.js` — Phase 2) and removing the `repoPath` parameter or the
  fallback (Phase 3).
- No behaviour change for existing callers — every current call passes `repoPath`
  explicitly, so the `??` fallback is never exercised outside the new spec.
- `GithubIssue.js` builds `new IssueStatePaths()` zero-arg today (constructor default
  collaborator, ~line 66); the `{ repoContext } = {}` default keeps that call valid with no
  change.
- Verify with `make core-test` and `make core-lint` before considering the work done.
