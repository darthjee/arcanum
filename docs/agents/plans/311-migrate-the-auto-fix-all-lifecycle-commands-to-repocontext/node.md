# node Plan: Migrate the auto-fix-all lifecycle commands to RepoContext

Main plan: [plan.md](plan.md)

## Overview

Migrate five commands dispatched from `core/bin/arcanum` so their constructor
receives a `RepoContext` instead of taking `repoPath` as a leading positional
method argument:

| command name | class |
| --- | --- |
| `auto-fix-all-checkout-from-main` | `commands/AutoFixAllCheckoutFromMain.js` |
| `auto-fix-all-cleanup-artifacts` | `commands/AutoFixAllCleanupArtifacts.js` |
| `auto-fix-all-reply-comment` | `commands/AutoFixAllReplyComment.js` |
| `auto-fix-all-wait-ci` | `commands/AutoFixAllWaitCi.js` |
| `auto-fix-all-wait-ci-and-merge` | `commands/AutoFixAllWaitCiAndMerge.js` |

The enabling infra already shipped in #309 (`Dispatcher` / `commands.js` /
`takesRepoContext` flag) and the reference pattern is #310's
`ArcanumSplitIssueFinish` (`constructor(repoContext, { ...testDeps } = {})`,
`this._repoContext.repoPath`, a retained `repoPathValidator = new RepoPath()`
dep still called as the first step).

## Context

- `Dispatcher` (`core/lib/core/dispatcher.js`) already does everything the
  command side needs: when `COMMANDS[name].takesRepoContext` is `true` it builds
  a lazy `new RepoContext({ repoPath: args[0] })`, constructs the command as
  `new ModuleClass(repoContext)`, and strips `args[0]` from the method args
  (`args.slice(1)`). Nothing in `Dispatcher` or `core/bin/arcanum` changes.
- Skill `steps/*.md` and `scripts/*.sh` call sites keep passing `repoPath` as
  the leading positional argument — leave them untouched. The
  `core/spec/bin/*Parity_spec.js` suites invoke the real `core/bin/arcanum`
  binary with that same argv, so they stay green with no edit.
- `AutoFixAllGithub` is out of scope (sub-issue 4, #312). It keeps its
  positional-`repoPath` method signature and its `RepoContextFactory.build(repoPath)`
  usage. `AutoFixAllWaitCiAndMerge` composes it, so passing
  `this._repoContext.repoPath` down to `AutoFixAllGithub#prMerge` is an accepted
  interim asymmetry until #312.
- Two commands currently build their own context internally and must stop:
  - `AutoFixAllReplyComment._repoContext(repoPath)` builds a per-call
    `RepoContext` (wired with injected `origin`/`githubToken`) only to feed
    `IssueClient`.
  - `AutoFixAllWaitCi` builds a per-call `RepoContextFactory` bundle in
    `_prOperations(repoPath)` / `_prChecker(repoPath)`.
- `RepoContextFactory.build(repoPath)` internally constructs a fresh
  `RepoContext` plus the context-bound clients (`gitClient`/`gitBranch`/`git`/
  `githubClient`/`issueClient`). `PrOperations`/`PrChecker` need that whole
  bundle, not a bare `RepoContext` — hence Step 1 adds a `buildFromContext`
  path that reuses a ready `RepoContext` instead of making a second one.
- Per the issue's resolved questions:
  - `AutoFixAllWaitCi` keeps `RepoConfig` as an injected dep, called as
    `getIgnoredCheckPatterns(this._repoContext.repoPath)` (not routed through
    `repoContext.configChain`).
  - `AutoFixAllWaitCi` and `AutoFixAllWaitCiAndMerge` **gain** a
    `RepoPath#validate` first step (they only had a truthiness check before) —
    a deliberate error message/timing change bringing them in line with the
    other three ahead of #314's uniform pass. The existing bare-USAGE check for
    an empty/missing `repoPath` stays *before* `validate` so that case's message
    is unchanged.
  - `AutoFixAllReplyComment` does **not** gain validation (it never had it) —
    keep parity.

### Migration recipe (applied per command in Steps 2–6)

1. Add `takesRepoContext: true` to the command's entry in
   `core/lib/core/commands.js` (same commit as the constructor change, so the
   flag and the signature never diverge).
2. Constructor becomes `constructor(repoContext, { ...deps } = {})`; store
   `this._repoContext = repoContext`; keep every existing injectable test
   collaborator in the second options arg.
3. Drop the leading `repoPath` parameter from the entry method and from every
   private helper that only received it to thread it further; read
   `this._repoContext.repoPath` at the points that need it.
4. Update the command's `core/spec/lib/commands/*_spec.js`: construct with a
   `RepoContext` (real, or the `createRepoContextMock` support factory, or a
   plain `{ repoPath }` stand-in where only `repoPath` is read) as the first
   arg; move the old positional `repoPath` out of the `run(...)` call. Keep the
   `execFileAsync` / fake-clock / `sleepFn` injection paths working.

## Steps

- [01 — Add RepoContextFactory.buildFromContext](node/01-repocontextfactory-build-from-context.md)
- [02 — Migrate AutoFixAllCheckoutFromMain](node/02-migrate-checkout-from-main.md)
- [03 — Migrate AutoFixAllCleanupArtifacts](node/03-migrate-cleanup-artifacts.md)
- [04 — Migrate AutoFixAllReplyComment](node/04-migrate-reply-comment.md)
- [05 — Migrate AutoFixAllWaitCi](node/05-migrate-wait-ci.md)
- [06 — Migrate AutoFixAllWaitCiAndMerge](node/06-migrate-wait-ci-and-merge.md)

## CI Checks

- `core/`: `yarn test` (CircleCI job: `test`)
- `core/`: `yarn lint` (CircleCI job: `checks`)

## Notes

- Do Steps 2–6 as independent, self-contained commits — each leaves the tree
  green (`yarn test` + `yarn lint`), because the flag flip and the signature
  change land together per command. Step 1 must land before Step 5; Step 6 must
  land after Step 5.
- After migration, `AutoFixAllWaitCi`/`AutoFixAllWaitCiAndMerge` unit specs must
  inject a fake `repoPathValidator` (e.g. `{ validate: async () => {} }`) —
  otherwise the real `RepoPath#validate` will `stat()` the fake `'/repo/path'`
  and throw `Error: not a directory: /repo/path`.
- `core/lib/core/commands.js`'s `@property {boolean} [takesRepoContext]` JSDoc
  still ends with "No real command entry sets this yet." — already stale since
  #310. Optionally correct it to name the flag-on commands while editing the
  file; not required by this issue.
- The `dispatch-fixture-repo-context` test entry and `DispatchFixtureRepoContext`
  are untouched — they already cover the flag-on dispatch path end to end.
- Interim asymmetry to call out in the `AutoFixAllWaitCiAndMerge` source
  comment: `AutoFixAllGithub` is still positional-`repoPath` until #312, so
  `prMerge` is called as `this._github.prMerge(this._repoContext.repoPath, modelEmail)`.
