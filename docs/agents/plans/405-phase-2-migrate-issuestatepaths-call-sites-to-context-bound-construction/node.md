# node Plan: Phase 2: Migrate IssueStatePaths call sites to context-bound construction

Main plan: [plan.md](plan.md)

## Overview

Phase 2 of #397. Phase 1 (#404, merged as `69b72b9`) gave `IssueStatePaths` the options-bag
constructor `new IssueStatePaths({ repoContext })` and a `repoPath ?? this._repoContext?.repoPath`
fallback inside `paths(repoPath, id)`. This phase updates the three callers to construct
`IssueStatePaths` with the context they hold and to call `paths(undefined, id)` instead of
threading `repoPath` explicitly. The `paths()` signature and the Phase-1 fallback stay in
place — collapsing `paths()` to `paths(id)` and dropping the fallback is Phase 3 (#406).

## Context

Current state of the three callers (all still pass `repoPath` into every `paths()` call):

- **`core/lib/services/IssueStateService.js`** — constructor takes a `{ context }` options
  bag, stores `this._context`; default collaborator `issueStatePaths = new IssueStatePaths()`
  (zero-arg). Three methods call `this._issueStatePaths.paths(this._context.repoPath, id)`:
  `get` (line 58), `_mutate` (line 146), `_corrupt` (line 169). `this._context` is always a
  real `RepoContext` in every construction site and spec.
- **`core/lib/commands/shared/IssueState.js`** — constructor `(repoContext, { ... })`, stores
  `this._repoContext` (always real — CLI entrypoint via `Dispatcher`); default
  `issueStatePaths = new IssueStatePaths()`. `run()` destructures `repoPath` off
  `this._repoContext` for the usage-message validation guard (lines 77–81) and also calls
  `this._issueStatePaths.paths(repoPath, id)` for the `mkdir` (line 83).
  `_issueStateService()` forwards both `context: this._repoContext` and
  `issueStatePaths: this._issueStatePaths` to the per-call `IssueStateService`.
- **`core/lib/commands/shared/GithubIssue.js`** — constructor `(repoContext, { ... })`,
  stores `this._repoContext`; default `issueStatePaths = new IssueStatePaths()`. **`fetch()`
  never reads `this._repoContext`** — it works purely off its explicit `repoPath` argument,
  and `this._repoContext` is `undefined` on the collaborator path and in every
  `GithubIssueFetch_spec.js` case (`new GithubIssue(undefined, …)`). `_issueStateService(repoPath)`
  builds a fresh per-call `context = new RepoContext({ repoPath })` and forwards
  `issueStatePaths: this._issueStatePaths` (the shared, currently zero-arg instance).

Decision (from issue discussion): `IssueStateService` + `IssueState` bind the collaborator
to the context they already hold, constructed in the deps destructuring default (matching
the QueueStore / RepoConfig / GithubToken refactors). `GithubIssue` cannot bind to
`this._repoContext` (it would resolve to `undefined` and break `fetch`), so it instead
forwards a **per-call** `new IssueStatePaths({ repoContext: context })` built alongside the
per-call `RepoContext`; its constructor `issueStatePaths` dep is retained as an (now unused,
shared) injection seam — full removal is deferred to Phase 3 / the Origin rework (#399).

## Implementation Steps

### Step 1 — Context-bind `IssueStateService` and `IssueState` (the always-context callers)

**`core/lib/services/IssueStateService.js`**

- Change the deps default from `issueStatePaths = new IssueStatePaths()` to
  `issueStatePaths = new IssueStatePaths({ repoContext: context })`. `context` is
  destructured before `issueStatePaths` in the same object pattern, so it is in scope
  (destructuring defaults evaluate left to right).
- In `get`, `_mutate`, and `_corrupt`, change
  `this._issueStatePaths.paths(this._context.repoPath, id)` to
  `this._issueStatePaths.paths(undefined, id)`.
- No JSDoc change needed (the `@param {IssueStatePaths} [deps.issueStatePaths]` line still
  holds).

**`core/lib/commands/shared/IssueState.js`**

- Change the deps default from `issueStatePaths = new IssueStatePaths()` to
  `issueStatePaths = new IssueStatePaths({ repoContext })` (the positional `repoContext`
  param is in scope for the options-param defaults).
- In `run()`, change `this._issueStatePaths.paths(repoPath, id)` to
  `this._issueStatePaths.paths(undefined, id)`. Keep the `const { repoPath } = this._repoContext;`
  destructure and the `if (!repoPath || …)` guard exactly as-is — the guard still needs
  `repoPath`.
- Leave `_issueStateService()` unchanged: it keeps forwarding `context: this._repoContext`
  and `issueStatePaths: this._issueStatePaths`, which is now the same context-bound instance
  — consistent, since `this._repoContext` is always real here.

**Spec: `core/spec/lib/commands/shared/IssueState_spec.js`** — only the
`subcommand dispatch (stubbed IssueStateService)` block needs changes:

- The `pathsSpy` `callFake((rp, id) => …)` builds paths with `path.join(rp, …)`. After the
  change `run()` calls `paths(undefined, id)`, so `rp` is `undefined` and every test in the
  block throws. Update the fake to fall back to the closure `repoPath` (the per-test temp
  dir), e.g. `callFake((rp, id) => { const base = rp ?? repoPath; return { stateDir: …, … }; })`.
- The assertion in `'resolves the state dir/file paths from the injected context repoPath'`
  (`expect(pathsSpy).toHaveBeenCalledWith(repoPath, '42')`) becomes
  `expect(pathsSpy).toHaveBeenCalledWith(undefined, '42')`; reword the `it` description to
  reflect that resolution now happens inside `IssueStatePaths` (e.g. `'calls paths() without
  an explicit repoPath — resolution is context-bound'`).
- The `argument validation`, `end to end against a real state file`, and `#_issueStateService`
  blocks need no change: they use the real default collaborator, which now resolves via the
  real `buildContext()` `repoPath`; the `repoPath: ''` case still throws the usage message
  before reaching `paths()`.

The `IssueStateService` specs (`IssueStateServiceSet_spec.js`,
`IssueStateServiceWrite_spec.js`, `IssueStateServiceAppendJson_spec.js`) need no change —
each constructs `new IssueStateService({ context, lock })` with a real
`RepoContext({ repoPath })` (temp dir) and lets `issueStatePaths` default, so
`paths(undefined, id)` resolves via `context.repoPath` unchanged.

### Step 2 — Context-bind `GithubIssue` via a per-call instance

**`core/lib/commands/shared/GithubIssue.js`**

- In `_issueStateService(repoPath)`, replace the forwarded
  `issueStatePaths: this._issueStatePaths` with a per-call instance bound to the per-call
  context: `issueStatePaths: new IssueStatePaths({ repoContext: context })` (built from the
  `context = new RepoContext({ repoPath })` already created two lines above).
- Leave the constructor `issueStatePaths = new IssueStatePaths()` default and the
  `this._issueStatePaths = issueStatePaths` assignment in place — retained as an injection
  seam; it is now unused. Optionally reword its `@param` line from "forwarded to each
  per-call `IssueStateService`" to note it is retained but no longer forwarded. Do **not**
  remove the dep or the `IssueStatePaths` import (the import is still used by both the
  default and the new per-call construction).
- `fetch()` and its explicit `repoPath` argument are unchanged.

**Specs** — none needed. `GithubIssueFetch_spec.js` builds `new GithubIssue(undefined, …)`
and calls `fetch(repoPath, id)` against a real temp dir; the per-call
`new IssueStatePaths({ repoContext: context })` resolves `paths(undefined, id)` via the
per-call `context.repoPath` (the temp dir), so `issue-<id>.json` still lands under it. The
`GithubIssue` spec factory (`core/spec/support/factories/githubIssue.js`) does not stub
`issueStatePaths`.

## Files to Change

- `core/lib/services/IssueStateService.js` — deps default becomes
  `new IssueStatePaths({ repoContext: context })`; three `paths()` calls drop the explicit
  `repoPath` (`paths(undefined, id)`).
- `core/lib/commands/shared/IssueState.js` — deps default becomes
  `new IssueStatePaths({ repoContext })`; `run()`'s `paths()` call drops the explicit
  `repoPath`; validation guard untouched.
- `core/lib/commands/shared/GithubIssue.js` — `_issueStateService()` forwards a per-call
  `new IssueStatePaths({ repoContext: context })` instead of `this._issueStatePaths`;
  constructor dep retained (unused seam).
- `core/spec/lib/commands/shared/IssueState_spec.js` — in the stubbed-dispatch block, make
  the `pathsSpy` fake tolerate an `undefined` first arg and update the one
  `toHaveBeenCalledWith` assertion (+ its `it` wording).

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test` in `core/`)
- `core/`: `make core-lint` (CI job: `lint` — `yarn lint` in `core/`)

## Notes

- The interim `paths(undefined, id)` call shape is deliberate and matches the issue text;
  Phase 3 (#406) collapses the signature to `paths(id)` and removes the fallback.
- `GithubIssue.this._issueStatePaths` is left assigned-but-unused. ESLint's `no-unused-vars`
  does not flag `this.` field assignments, so `make core-lint` should stay clean; if a
  custom rule does flag it, prefer dropping the field + its `@param` (still leaving the
  `IssueStatePaths` import and the per-call construction) over reintroducing the forward.
- Do not touch `GithubIssue#fetch(repoPath, id)` / `_issueStateService(repoPath)` signatures
  or `IssueStatePaths.paths()` itself — those belong to Phase 3 (#406) and the Origin rework
  (#399).
