# Node Plan: Refactor AutoFixAllGithub to extract responsibilities

Main plan: [plan.md](plan.md)

## Overview

Three sequential extractions inside `core/`, each landing with its own unit
spec and leaving every `core/spec/bin/autoFixAllGithubParity/*` spec green and
untouched:

1. `RepoContextFactory` — one place that builds `RepoContext` + all
   context-bound clients; `AutoFixAllGithub` adopts it in `_prOperations` and
   `_issueTagger`.
2. `TagMutationService` — owns the strict (throw, don't warn) tag-mutation
   decision tree currently inline in `AutoFixAllGithub._mutateTag`.
3. Constructor surface reduction — `AutoFixAllGithub` down to 3 defaulting
   collaborators once parts 1 & 2 absorb the low-level deps.

## Context

Current `AutoFixAllGithub` (`core/lib/commands/AutoFixAllGithub.js`):

- `_prOperations(repoPath)` builds `RepoContext` + `gitClient` + `gitBranch` +
  `git` + `githubClient`, then `new PrOperations({ context, gitClient,
  gitBranch, git, githubClient })`. `PrOperations`'s constructor also accepts
  `githubClient`/`mergeBodyResolver` and defaults what it isn't given, so
  handing it a superset object is safe.
- `_issueTagger(repoPath)` builds a `RepoContext` and calls
  `issueTaggerFactory(context)`; the default factory is
  `(context) => new IssueTagger({ context, issueClient: new IssueClient({ context, fetchFn, timeoutMs }) })`.
- `_mutateTag(repoPath, id, tag, action)` reimplements the decision tree on
  `IssueTagger`'s primitives (`fetchLabels`/`addLabel`/`removeLabel`) with a
  **strict** policy: `shipit` human-only guard, `TAG_TO_LABEL[tag]` resolution,
  "already present / not present → nothing to do" branch, and throw-on-failure
  (`Error`, not the warn-and-continue `IssueTagger#mutateTag` uses). It
  resolves `repoRef` via `this._origin.resolveWithRef(repoPath)`.
- `hasShipitLabel(repoPath, id)` already delegates to
  `this._issueTagger(repoPath).hasLabel(id, 'shipit')` (landed in #302) and
  wraps failures/absence in `DispatchFailure('', 1)`. It stays as-is — a
  `utils/` (`IssueTagger`) must not learn about `DispatchFailure`/exit codes.
- Constructor holds 9 collaborators: `origin`, `githubToken`,
  `issueStateService`, `configChain`, `issueTaggerFactory`, `fetchFn`,
  `timeoutMs`, `execFileAsync`, `branchCleanup`.
- `cleanupBranch` delegates to `BranchCleanup` (untouched by this plan).
- `AutoFixAllWaitCiAndMerge.js` does `new AutoFixAllGithub()` (zero args) and
  calls `#prMerge` — zero-arg construction and the public method surface must
  stay stable.

`RepoContext` (`core/lib/context/RepoContext.js`) constructor:
`{ repoPath, origin?, githubToken?, issueStateService?, configChain?, githubIssue? }`
— `issueStateService`/`configChain`/`githubIssue` self-default.

`IssueClient` and `GitHubClient` are the two context-bound REST wrappers
(issue-domain vs PR-domain); both take `{ context, fetchFn?, timeoutMs? }`.

Layering rule (`docs/agents/architecture/overview-and-layout.md`):
`commands/` → `services/` → `utils/`. `TagMutationService` in `services/`
depending on `utils/issue/IssueTagger.js` is the allowed direction.

Out of scope (from the issue): migrating `AutoFixAllWaitCi._prOperations` to
the factory (tracked as sub-issue #305); any change to `PrOperations` /
`PrChecker` / `SafeFetcher` / `BranchCleanup` internals; any change to
`IssueTagger`'s warn-and-continue policy; any `github.sh` behavior change.

## Steps

- [01 — Extract RepoContextFactory](node/01-extract-repo-context-factory.md)
- [02 — Extract TagMutationService](node/02-extract-tag-mutation-service.md)
- [03 — Reduce the constructor surface](node/03-reduce-constructor-surface.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- **Parity specs are the acceptance gate.** All 7
  `core/spec/bin/autoFixAllGithubParity/*` specs (`pr_number`, `pr_state`,
  `pr_merge`, `cleanup_branch`, `has_shipit_label`, `add_tag`, `remove_tag`)
  must pass unchanged after every step — they encode byte-identical
  shell-vs-native behavior.
- Preserve the three `_mutateTag` error strings **verbatim** — they are
  asserted by `add_tag`/`remove_tag` parity and by
  `AutoFixAllGithub_spec.js`:
  `Error: shipit is human-only; scripts must not add or remove it`,
  `Error: could not fetch issue #<id> from <repoRef>`,
  `Error: could not update issue #<id> on <repoRef>`.
- `RepoContext` imports `GithubIssue` from `../commands/GithubIssue.js`; the new
  `RepoContextFactory` imports `RepoContext`, and `AutoFixAllGithub` imports the
  factory — no new import cycle (`GithubIssue` ≠ `AutoFixAllGithub`).
- Keep each per-call builder's existing JSDoc intent (cheap, zero-I/O
  construction per call) — move/trim the docstrings rather than dropping them.
- `core/spec/lib/` mirrors `core/lib/`: new specs go at
  `core/spec/lib/context/RepoContextFactory_spec.js` and
  `core/spec/lib/services/TagMutationService_spec.js` (both dirs already exist).
