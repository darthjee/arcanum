# node Plan: Migrate SpawnIssue and AutoFixAllGithub to constructor-injected RepoContext

Issue: [312-migrate-spawnissue-and-autofixallgithub-to-constructor-injected-repocontext.md](../../issues/312-migrate-spawnissue-and-autofixallgithub-to-constructor-injected-repocontext.md)

## Overview

Part of #308. `SpawnIssue` (`core/lib/commands/SpawnIssue.js`) and `AutoFixAllGithub`
(`core/lib/commands/AutoFixAllGithub.js`) are the last GitHub-facing entrypoints
still built zero-arg by the `Dispatcher`, each re-deriving its own per-call
`RepoContext` once `repoPath` is known and taking `repoPath` as a leading
positional argument on every method. This migrates both to the established
`takesRepoContext` pattern (see #309 infra, #310/#311 siblings): the `Dispatcher`
builds `new RepoContext({ repoPath: args[0] })`, injects it as the first
constructor argument, and strips `args[0]` from the method args.

## Context

- **Registry**: `core/lib/core/commands.js` — `spawn-issue` and the seven
  `auto-fix-all-github-*` entries (`add-tag`, `cleanup-branch`, `has-shipit-label`,
  `pr-merge`, `pr-number`, `pr-state`, `remove-tag`) currently lack
  `takesRepoContext`. All seven `auto-fix-all-github-*` entries share the single
  `AutoFixAllGithub` class, so they must flip together.
- **`SpawnIssue`** currently: `constructor({ repoPath, origin, githubIssue, configChain, execFileAsync, sleepFn, labelApplicator, issueLinker } = {})`,
  builds its context via `_repoContext(repoPath)` (a direct `new RepoContext({ repoPath, origin, githubIssue, configChain })`),
  and `run(repoPath, parentId, title, bodyFile, asSubissueFlag)`. It reaches
  `RepoContext#resolve` / `#readConfig` / `#createIssue`, and still needs the raw
  `repoPath` for `_cleanup` and the `labelApplicator` / `issueLinker` delegates
  (which take a raw `repo` slug, derived from `context.resolve()`).
- **`AutoFixAllGithub`** currently: `constructor({ repoContextFactory, issueTaggerFactory, branchCleanup } = {})`,
  with `_prOperations(repoPath)` / `_issueTagger(repoPath)` / `_tagMutationService(repoPath)`
  each calling `this._repoContextFactory.build(repoPath)` to get a fresh bundle.
  `RepoContextFactory` already exposes `buildFromContext(context)` (used by the
  #311 sibling `AutoFixAllWaitCi`) that wraps an existing `RepoContext` into the
  same six-key bundle — `PrOperations` / `IssueTagger` / `TagMutationService` need
  the bundle, not a bare `RepoContext`, so the factory stays. `cleanupBranch`
  delegates straight to `BranchCleanup#cleanupBranch(repoPath, id)` with a raw
  path — no context involved.
- **Internal callers** (not via `core/bin/arcanum`):
  - `AutoFixAllWaitCiAndMerge` builds `new AutoFixAllGithub()` and calls
    `this._github.prMerge(repoPath, modelEmail)` with an explicit
    `// Interim asymmetry: ... still positional-repoPath until #312` comment.
  - `ArcanumSplitIssueCreateSubIssue` (already `takesRepoContext`, holds
    `this._repoContext`) defaults `spawnIssue = new SpawnIssue()` and calls
    `this._spawnIssue.run(this._repoContext.repoPath, issueId, title, bodyFile, AS_SUBISSUE_FLAG)`.
- **CLI contract is unchanged**: the `Dispatcher` strips the leading `repoPath`
  for flagged entries, so `core/bin/arcanum <cmd> <repo_path> ...` behaves
  identically. The `spec/bin/*Parity_spec.js` suites (`spawnIssueParity`,
  `autoFixAllGithubParity/`, `arcanumSplitIssueCreateSubIssueParity`,
  `autoFixAllWaitCiAndMergeParity`) should pass with no edits — run them to
  confirm.
- Keep the `USAGE` strings unchanged (they still read `<repo_path>` — matches the
  #311 `AutoFixAllWaitCi` precedent — but the presence guard now checks
  `this._repoContext.repoPath`).
- Skill `.md` call sites and `arcanum/_lib/*.sh` wrappers are untouched: they keep
  passing `repoPath` as the leading positional argument.

## Steps

- [01 — Flip the registry flags](node/01-flip-registry-flags.md)
- [02 — Migrate SpawnIssue and its caller](node/02-migrate-spawnissue.md)
- [03 — Migrate AutoFixAllGithub and its caller](node/03-migrate-autofixallgithub.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`) — run from `core/`.
- `core/`: `yarn lint` (CI job: `checks`) — run from `core/`.

## Notes

- Out of scope: other command families (#313) and the `takesRepoContext` flag /
  `commandArgs()` branch removal (#314).
- `AutoFixAllGithub_spec.js` has a test ("builds a fresh, context-bound bundle per
  call via RepoContextFactory") whose premise is *per-call varying `repoPath`* —
  it calls `github.prState('/fake/repo/one')` then `github.prState('/fake/repo/two')`
  on one instance. After the migration `repoPath` is fixed at construction, so
  this test must be rewritten to assert the single-context path (one `repoPath`
  per instance, still routed through the injected `execFileAsync`/`fetchFn` via
  `buildFromContext`) rather than removed outright.
- In `AutoFixAllGithub_spec.js`'s `newGithub` helper, the
  `origin`/`githubToken`/`issueStateService`/`configChain` overrides currently
  feed the `RepoContextFactory`; after the migration `buildFromContext` reads
  those off the passed `RepoContext`, so they must move into the
  `new RepoContext({ repoPath, origin, githubToken, issueStateService, configChain })`
  the helper builds, leaving only `{ execFileAsync, fetchFn, timeoutMs }` on the
  factory — mirroring `AutoFixAllWaitCi_spec.js`'s `newWaitCi`.
