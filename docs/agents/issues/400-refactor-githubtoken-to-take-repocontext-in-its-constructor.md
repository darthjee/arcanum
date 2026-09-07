# Issue: Refactor GithubToken to take repoContext in its constructor

## Description

`GithubToken` (`core/lib/utils/github/GithubToken.js`) exposes one public method —
`get(repoPath)` — taking `repoPath` as an explicit argument (threaded on to the private
`_switchGhUser`/`_getGhUser` helpers as the `git config` `cwd`). Its constructor today only
accepts `{ execFileAsync }`.

It has exactly two production `.get()` call sites:

- **`context/RepoContext.js:93`** — `this._githubToken.get(this.repoPath)`. `RepoContext`
  builds `GithubToken` zero-arg as a constructor default; `RepoContextFactory.js` builds one
  shared instance and forwards it into every `RepoContext` it creates. Each `getToken()`
  call re-passes `this.repoPath`.
- **`services/GithubIssueService.js:97`** — `this._githubToken.get(repoPath)`, inside the
  per-call `issueClient(repoPath)` helper. `GithubIssueService` receives `repoPath` per
  method from its callers and hands `IssueClient` a plain `{ resolveWithRef, getToken }`
  object rather than a real `RepoContext`.

`commands/shared/GithubIssue.js` never calls `.get()` — it only constructs `GithubToken`
zero-arg and forwards it into `GithubIssueService`.

## Problem

The sibling refactors this issue was split alongside — `QueueStore` (#395, merged as #407)
and `RepoConfig` (#396, merged as #408) — were each a single-owner utility whose one caller
already held a `RepoContext`, so they migrated cleanly: `repoContext` became a **required**
constructor parameter and `repoPath` was dropped from every method.

`GithubToken` is threaded through two callers, one of them in the `services/` layer.
`core/lib/`'s documented one-way layering (`commands` → `context`/`services` → `utils`, see
`docs/agents/architecture/script-engine.md`) currently says `services/` may depend on
`utils/` only — so `GithubIssueService` cannot hold a `RepoContext` and keeps threading
`repoPath` per call. That is the only thing blocking `GithubToken` from the same clean
migration its siblings got.

Resolution (decided during issue discussion): **relax the boundary just far enough** to let
a `services/` method accept a caller-supplied, duck-typed `{ repoPath }` context object *as
a parameter*, without importing `context/RepoContext.js`. This keeps the import graph
acyclic and the `no-restricted-imports` guardrail green (it only bars importing
`commands/`), while letting `GithubIssueService` — and through it `GithubToken` — stop
threading `repoPath`.

## Solution

### Phase 1: `GithubToken` accepts `repoContext`

- Extend `GithubToken`'s constructor to also accept an optional `repoContext` alongside the
  existing `execFileAsync` dep.
- `get(repoPath)` keeps its `repoPath` parameter but falls back to
  `this._repoContext.repoPath` when `repoPath` isn't passed — both calling styles work
  during the transition, and `RepoContext`/`RepoContextFactory`'s zero-arg internal
  construction keeps working unchanged. Mirrors the dual mode already shipped in
  `commands/shared/GithubIssue.js`.
- Spec: add coverage constructing with a `repoContext` and omitting `repoPath` per call,
  reusing `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`. Existing per-call-`repoPath` cases
  are untouched.

### Phase 2: `GithubIssueService` accepts a duck-typed context

- Add an optional `repoContext` constructor parameter to `GithubIssueService`, typed as a
  plain `{ repoPath }` shape — **no `import` of `context/RepoContext.js`**, matching how it
  already builds `IssueClient`'s `context` shape by hand.
- Forward it into the `GithubToken` (and `Origin`) it constructs, and let `issueClient()` /
  `create()` read `repoPath` from `this._repoContext` when present, falling back to the
  explicit `repoPath` parameter otherwise (dual mode, for the zero-arg collaborator/
  bootstrap paths).
- Update `docs/agents/architecture/script-engine.md`'s `services/` bullet with the carve-out
  note: a `services/` method may accept a caller-supplied context-shaped `{ repoPath }`
  object as a parameter without importing `context/`.
- Spec both paths.

### Phase 3: Migrate the `RepoContext` call site

- Have `RepoContext` construct its own `new GithubToken({ repoContext: this })` in the
  constructor body (still overridable by an injected `githubToken` for specs), and call
  `this._githubToken.get()` with no argument at line 93.
- `RepoContextFactory` stops sharing a single `GithubToken` instance (it is stateless — a
  per-`RepoContext` instance has no meaningful cost); drop the now-unused shared
  `githubToken` dep from the factory if nothing else needs it.

### Phase 4: Trim JSDoc / finalize

- Update `GithubToken`'s and `GithubIssueService`'s JSDoc, and whether the per-call
  `repoPath` fallback stays a permanent optional override or is removed once every caller
  passes a context — decide when the plan is written, once the bootstrap paths
  (`RepoContext`'s and `GithubIssue`'s zero-arg construction of `GithubIssueService`) are
  settled.

### Done when

- `GithubToken` accepts `repoContext` at construction; `RepoContext.js` calls `get()` with
  no argument.
- `GithubIssueService` accepts a duck-typed `{ repoPath }` context (no `RepoContext`
  import) and stops threading `repoPath` into `GithubToken` when it has one.
- `RepoContext`/`RepoContextFactory`'s existing zero-arg construction path still works.
- `docs/agents/architecture/script-engine.md`'s `services/` layering bullet documents the
  parameter-duck-typing carve-out.
- Specs cover both the `repoContext`-constructed and legacy `repoPath`-per-call paths for
  `GithubToken` and `GithubIssueService`.
- `make core-test` passes; `make core-lint` is clean.

### Out of scope

- Any other repoPath-per-call utility — see the companion issues for `IssueStatePaths.js`,
  `BranchCleanup.js`, `Origin.js`, `ConfigChain.js`, and `IssueFile.js`.
- A full `services/ → context/` import edge — the relaxation here is deliberately limited to
  duck-typed parameters, not imports; the one-way import graph is preserved.
- Migrating `Origin`'s per-call `repoPath` inside `GithubIssueService` — that is `Origin`'s
  own companion issue; touch it here only insofar as forwarding the shared `repoContext`
  into it falls out naturally.

## Benefits

- `GithubToken` and `GithubIssueService` gain the constructor shape the rest of the repo's
  repo-scoped collaborators use (`AutoFixAllQueue`, `GitClient`, `PrOperations`,
  `GithubIssue`, and now `QueueStore`/`RepoConfig`).
- `repoPath` threading stops at construction on the `RepoContext` path.
- The `services/` layer boundary gets an explicit, documented rule for the context-shaped
  parameter case instead of an implicit "utils-only" reading that the code already bends.
