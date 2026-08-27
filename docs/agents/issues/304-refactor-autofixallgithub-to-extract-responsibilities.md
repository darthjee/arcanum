# Issue: Refactor AutoFixAllGithub to extract responsibilities

## Problem

`AutoFixAllGithub` (`core/lib/commands/AutoFixAllGithub.js`) is already a thin
facade that delegates PR lifecycle to `PrOperations`, branch teardown to
`BranchCleanup`, and tag/label mutation to `IssueTagger`. However, it still
holds responsibilities that violate the layered architecture
(`commands/` → `services/` → `utils/`):

- `_mutateTag` concentrates decision logic (`shipit` human-only validation,
  label resolution via `TAG_TO_LABEL`, `fetchLabels`, the "already present /
  nothing to do" tree, error wrapping, and message formatting) that belongs in
  a service, not in the command.
- The per-call builders `_prOperations(repoPath)` and `_issueTagger(repoPath)`
  rebuild a `RepoContext` with the same deps. `_prOperations(repoPath)` is
  duplicated almost identically in `AutoFixAllWaitCi` (refactored in #300),
  creating real duplication between two commands.
- The constructor holds 9 shared collaborators, increasing coupling and
  injection noise.

## Scope

### In scope

- Create `RepoContextFactory` and adopt it inside **`AutoFixAllGithub` only**
  (`_prOperations` + `_issueTagger`).
- `TagMutationService` extraction, `hasShipitLabel` cleanup, constructor-surface
  reduction — all within `AutoFixAllGithub`.

### Out of scope

- **Migrating `AutoFixAllWaitCi._prOperations` to `RepoContextFactory`.** The
  factory is designed to accept the reduced dep subset `AutoFixAllWaitCi` needs
  (only `origin`/`githubToken`), so it is *ready* for that consumer, but wiring
  it in is deferred to a follow-up sub-issue to keep this refactor tight and
  avoid re-touching a command that was just refactored in #300. Tracked as
  sub-issue #305. Until then the `_prOperations` duplication between the two
  commands remains.
- No stdout/exit-code changes to any `github.sh` subcommand (parity specs hold).
- No changes to `PrOperations` / `PrChecker` / `SafeFetcher` / `BranchCleanup`
  internals.
- No change to `IssueTagger`'s warn-and-continue error policy (only
  `TagMutationService` layers throw-on-error on top of it).
- No shared base class / mixin between `AutoFixAllGithub` and
  `AutoFixAllWaitCi` — once `RepoContextFactory` exists the remaining per-call
  builders are trivial one-line delegations, not worth a further abstraction.

## Solution

### 1. Extract `RepoContextFactory` (`core/lib/context/RepoContextFactory.js`)

- Given `repoPath`, builds the `RepoContext` plus **every context-bound client
  built off it**: `gitClient` + `gitBranch` + `git` + `githubClient` (PR-domain
  REST) + `issueClient` (issue-domain REST).
- Enables eliminating the `_prOperations(repoPath)` duplication between
  `AutoFixAllGithub` and `AutoFixAllWaitCi` — `AutoFixAllGithub` adopts it here;
  `AutoFixAllWaitCi` follows in #305.
- `_issueTagger(repoPath)` reuses the same `RepoContext` + `issueClient`.

#### API

- **Constructor** takes the shared low-level collaborators as options, mirroring
  `RepoContext`'s own optionals plus the client-building deps:
  `{ origin, githubToken, issueStateService?, configChain?, execFileAsync,
  fetchFn?, timeoutMs? }`. `issueStateService`/`configChain` are omittable —
  `AutoFixAllWaitCi` (in #305) will construct the factory without them and let
  `RepoContext` supply its own defaults (no per-call override API needed).
  `fetchFn`/`timeoutMs` feed **both** `githubClient` and `issueClient`.
- **`build(repoPath)`** — the only method. Returns a flat bundle
  `{ context, gitClient, gitBranch, git, githubClient, issueClient }`. The
  `context`+git+`githubClient` subset is shaped to hand straight into
  `new PrOperations(...)`.
- `_prOperations(repoPath)` becomes
  `new PrOperations(this._repoContextFactory.build(repoPath))` (extra
  `issueClient` key on the bundle is harmless).
- `_issueTagger(repoPath)` becomes
  `this._issueTaggerFactory(this._repoContextFactory.build(repoPath))` — the
  default `issueTaggerFactory` reads `.context` + `.issueClient` off the bundle.
  All bundle clients are zero-I/O, cheap-to-construct objects (per the existing
  `#_prOperations` docstring), so building the unused ones per call has no
  meaningful cost.
- **Scope:** the factory assembles the `RepoContext` + all context-bound clients
  built directly off it. It does **not** assemble `IssueTagger` itself —
  that stays in `AutoFixAllGithub` via its `issueTaggerFactory`.

### 2. Extract `TagMutationService` (`core/lib/services/TagMutationService.js`)

Owns the **strict** tag-mutation variant that `AutoFixAllGithub._mutateTag`
today rebuilds on `IssueTagger`'s primitives — deliberately *not*
`IssueTagger#mutateTag` (that one warns-and-continues and writes stdout/stderr
directly). Layer: `services/` depending on `utils/issue/IssueTagger.js` — the
allowed direction (`commands/ → services/ → utils/`).

- **Lifecycle:** per-call, context-bound (like `_prOperations`/`_issueTagger`),
  since `repoPath` varies call to call. Constructed as
  `new TagMutationService({ issueTagger, context })` — `context` supplies
  `repoRef` via `context.resolveWithRef()` (replacing today's
  `this._origin.resolveWithRef(repoPath)`, same result).
- **Wiring:** `AutoFixAllGithub` gains a `_tagMutationService(repoPath)` builder
  that composes `RepoContextFactory` + `issueTaggerFactory`, replacing the
  current `_issueTagger(repoPath)` + inline `_mutateTag`.
- **Method surface:** public `addTag(id, tag)` / `removeTag(id, tag)`, private
  shared `_mutate(id, tag, action)`. The `shipit` human-only guard moves here.
- **Returns, does not write:** the service returns the confirmation /
  "nothing to do" string; the command's dispatch harness prints it.
- **Error policy preserved exactly:** throws plain `Error` (not
  `DispatchFailure`) with the current messages verbatim —
  `Error: shipit is human-only; scripts must not add or remove it`,
  `Error: could not fetch issue #<id> from <repoRef>`,
  `Error: could not update issue #<id> on <repoRef>`. Parity specs guard this.
- **`tag → label` mapping** (`TAG_TO_LABEL[tag]`) stays in the service, as in
  `_mutateTag` today — no new `IssueTagger` primitive.
- `AutoFixAllGithub.addTag`/`removeTag` become one-line delegations to the
  per-call service.
- Files: `core/lib/services/TagMutationService.js` +
  `core/spec/lib/services/TagMutationService.js`.

### ~~3. Move `hasShipitLabel` into `IssueTagger`~~ — already done in #302

`IssueTagger.hasLabel(id, label)` (context-bound, case-insensitive exact match)
already exists as of #302, and `AutoFixAllGithub.hasShipitLabel` already
delegates to `this._issueTagger(repoPath).hasLabel(id, 'shipit')`. Nothing to
do here beyond what the other parts already cover.

- `hasShipitLabel` **intentionally stays on the command** as the thin
  `DispatchFailure('', 1)` facade over `IssueTagger.hasLabel`.
  `IssueTagger.hasLabel`'s own docstring makes this an explicit boundary — it
  throws a plain `Error`, never `DispatchFailure`; a `utils/` must not know
  about exit codes. The command keeps the try/catch → `DispatchFailure`, the
  `!hasShipit` → `DispatchFailure`, and the `return ''`.
- It keeps getting its `IssueTagger` from the shared `_issueTagger(repoPath)`
  helper — after part 1 that is
  `this._issueTaggerFactory(this._repoContextFactory.build(repoPath))`,
  the same helper `_tagMutationService(repoPath)` composes from. No new method
  on `TagMutationService` (it stays scoped to strict add/remove).
- The `'shipit'` literal stays: for `shipit` the canonical tag name and the
  GitHub label name are identical (`LABEL_TO_TAG`).

### 3. Reduce the constructor surface

Parts 1 & 2 leave the command holding only three collaborators — everything
else is absorbed by `RepoContextFactory`. Flatten the constructor to those
three, each defaulting:

```js
constructor({
  repoContextFactory = new RepoContextFactory(),
  issueTaggerFactory = (bundle) =>
    new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient }),
  branchCleanup = new BranchCleanup()
} = {}) { ... }
```

- **9 → 3.** `origin` / `githubToken` / `issueStateService` / `configChain` /
  `execFileAsync` / `fetchFn` / `timeoutMs` all move into `RepoContextFactory`'s
  constructor; the command no longer stores them individually.
- **Reject** the "`collaborators` object" alternative — nesting the 9 names one
  level down is cosmetic; it removes no responsibility.
- **No `tagMutationServiceFactory`.** `_tagMutationService(repoPath)` constructs
  `new TagMutationService({ issueTagger, context })` inline; tests drive it via
  the injected `issueTaggerFactory` + fake `fetch`. Add a factory later only if
  a spec proves it needs one.
- **Zero-arg construction still works** — `AutoFixAllWaitCiAndMerge`'s
  `new AutoFixAllGithub()` is unaffected; the public API stays stable.
- **Test impact:** the single `newGithub()` helper in
  `AutoFixAllGithub_spec.js` rewrites its flat `origin` / `githubToken` /
  `issueStateService` / `configChain` / `execFileAsync` / `fetchFn` /
  `timeoutMs` overrides into `new RepoContextFactory({ ... })` (plus
  `new BranchCleanup({ execFileAsync })` where a fake exec is needed).
  Contained to that helper.

## Rules

- Follow the established extract-and-delegate pattern from the #284/#292/#294
  refactors of this same command (small single-purpose collaborator, command
  keeps only a thin per-call builder + one-line delegation).
- Keep stdout/exit-code parity with `github.sh` (parity specs).
- `AutoFixAllWaitCiAndMerge.js` instantiates `AutoFixAllGithub` directly — the
  public API must remain stable during the refactor.
- `core/spec/lib/` must mirror the `core/lib/` structure.

## Testing

- New unit specs mirroring structure:
  `core/spec/lib/context/RepoContextFactory_spec.js` and
  `core/spec/lib/services/TagMutationService_spec.js`.
- `RepoContextFactory_spec` covers: bundle shape (`context` + all clients),
  `fetchFn`/`timeoutMs` reaching both `githubClient` and `issueClient`,
  `execFileAsync` reaching `gitClient`, and the omittable
  `issueStateService`/`configChain` defaulting via `RepoContext`.
- `TagMutationService_spec` covers: the add/remove "nothing to do" vs. mutate
  branches, the three verbatim error strings, the `shipit` guard, and
  return-not-write behavior.
- `AutoFixAllGithub_spec.js` updated for the 3-dep constructor (single
  `newGithub()` helper), existing behavior specs otherwise unchanged.
- All 7 `core/spec/bin/autoFixAllGithubParity/*` specs must stay green
  untouched — the acceptance gate for "no behavior changed".

## Migration needed?

No. Pure internal restructuring under `core/lib/` — no config-file shape
change, no renamed/moved repo-level file, no new top-level folder. Nothing for
`arcanum/migrations/repos/`.

## Suggested order

1. `RepoContextFactory` first (adopted in `AutoFixAllGithub`; `AutoFixAllWaitCi`
   follows in #305).
2. `TagMutationService` next (removes the last decision logic from the
   command).
3. Reduce the constructor surface.

(The former "`hasShipitLabel` into `IssueTagger`" step is dropped — already done
in #302.)
