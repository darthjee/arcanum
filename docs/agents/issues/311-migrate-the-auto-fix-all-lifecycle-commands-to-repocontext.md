# Issue: Migrate the auto-fix-all lifecycle commands to RepoContext

## Description

Part of #308, and the direct follow-on to sub-issue 1 (#309 — `Dispatcher` /
`commands.js` / `takesRepoContext` flag) and sub-issue 2 (#310 — the
`arcanum-split-issue` commands, whose `ArcanumSplitIssueFinish` is the reference
pattern for this migration).

With the infra from #309 in place, migrate the five `auto-fix-all` lifecycle
commands so they receive a `RepoContext` at construction time instead of taking
`repoPath` as a leading positional method argument.

Commands in scope, all dispatched from `core/bin/arcanum` via `core/lib/core/dispatcher.js`:

| command name | class |
| --- | --- |
| `auto-fix-all-checkout-from-main` | `commands/AutoFixAllCheckoutFromMain.js` |
| `auto-fix-all-cleanup-artifacts` | `commands/AutoFixAllCleanupArtifacts.js` |
| `auto-fix-all-reply-comment` | `commands/AutoFixAllReplyComment.js` |
| `auto-fix-all-wait-ci` | `commands/AutoFixAllWaitCi.js` |
| `auto-fix-all-wait-ci-and-merge` | `commands/AutoFixAllWaitCiAndMerge.js` |

`AutoFixAllGithub` is deliberately excluded — it already builds a per-call
`RepoContext` internally (via `RepoContextFactory`) and is handled in sub-issue 4
(#312) alongside `SpawnIssue`. `AutoFixAllConfig` and `AutoFixAllQueue` use
`repoPath` only for config-file / queue-file resolution, not the 5-collaborator
context, and are exempt (sub-issue 6, #314).

## Problem

`repoPath` is threaded as a leading positional CLI argument and re-resolved per
call, coupling every command to argv parsing and making each command re-derive
context it could receive once. Two of the five commands already work around this
by constructing their own repo context internally:

- `AutoFixAllReplyComment` builds a per-call `RepoContext` in `_repoContext(repoPath)`
  (wired with injected `origin` / `githubToken`) purely because
  `core/bin/arcanum` constructs a zero-arg `new AutoFixAllReplyComment()` before
  `repoPath` is known.
- `AutoFixAllWaitCi` builds a per-call `RepoContextFactory` bundle in
  `_prOperations(repoPath)` / `_prChecker(repoPath)` for the same reason, and
  separately reads config through an injected `RepoConfig`.

`AutoFixAllWaitCiAndMerge` is a thin composition of `AutoFixAllWaitCi` and the
out-of-scope `AutoFixAllGithub`.

## Expected Behavior

- Each command's constructor becomes `constructor(repoContext, { ...testDeps } = {})`,
  storing `this._repoContext`.
- The entry method drops its leading `repoPath` parameter; `Dispatcher` already
  strips `args[0]` and feeds it into the lazily-built `RepoContext` when
  `takesRepoContext: true`.
- `repoPath` is read as `this._repoContext.repoPath`; config access stays on the
  retained helper dep, called with `this._repoContext.repoPath`.
- Skill `steps/*.md` and `scripts/*.sh` call sites are unchanged — they keep
  passing `repoPath` as the leading positional argument for `Dispatcher` to
  consume, so the `core/spec/bin/*Parity_spec.js` suites stay green untouched.
- Stdout / exit-code parity with the shell counterparts is preserved, with one
  deliberate exception: `AutoFixAllWaitCi` and `AutoFixAllWaitCiAndMerge` gain a
  `RepoPath#validate` first step (see Solution), aligning their missing/invalid
  `repoPath` error message + timing with the other three commands ahead of the
  #314 uniform pass.

## Solution

### Shared per-command steps

1. Set `takesRepoContext: true` on the entry in `core/lib/core/commands.js`.
2. Change the constructor to `constructor(repoContext, { ...deps } = {})`,
   storing `this._repoContext` and keeping injectable test collaborators in the
   second options arg.
3. Read `repoPath` as `this._repoContext.repoPath` throughout; drop the leading
   `repoPath` parameter from the entry method and from every private helper that
   only received it to thread it further.
4. Update the command's `core/spec/lib/commands/*_spec.js` to construct with a
   `RepoContext` (real or a `repoContextFactory` support factory) instead of
   passing `repoPath` to the entry method, keeping the `execFileAsync` /
   fake-clock / `sleepFn` injection paths working.

### Per-command specifics

- **`AutoFixAllCheckoutFromMain` / `AutoFixAllCleanupArtifacts`** — retain the
  `execFileAsync` and `repoPath = new RepoPath({ execFileAsync })` test deps in
  the options arg; they already call `RepoPath#validate` first.
- **`AutoFixAllReplyComment`** — delete the `_repoContext(repoPath)` builder and
  pass `this._repoContext` straight into `IssueClient`; drop the now-unused
  `origin` / `githubToken` deps; retain `execFileAsync` / `fetchFn` / `timeoutMs`
  / `readFile`.
- **`AutoFixAllWaitCi`** —
  - Add a path to `RepoContextFactory.build` that accepts a `RepoContext`
    directly (rather than a `repoPath` it wraps internally), so `PrOperations` /
    `PrChecker` operate on the injected context instead of a second instance.
    `AutoFixAllGithub` keeps using the existing `build(repoPath)` path until
    #312.
  - Keep `RepoConfig` as an injected dep; call
    `getIgnoredCheckPatterns(this._repoContext.repoPath)`.
  - Keep the `sleepFn` / poll-interval knobs.
  - Add a `repoPathValidator = new RepoPath()` dep and call
    `this._repoPathValidator.validate(this._repoContext.repoPath)` as the first
    step (new behavior — see Expected Behavior).
- **`AutoFixAllWaitCiAndMerge`** — construct its child `AutoFixAllWaitCi` with the
  injected `repoContext`. `AutoFixAllGithub` is still on the positional-`repoPath`
  signature until #312, so `run(modelEmail)` calls
  `this._github.prMerge(this._repoContext.repoPath, modelEmail)` — an accepted
  interim asymmetry, removed in #312. Add the same `repoPathValidator` +
  `validate` first step as `AutoFixAllWaitCi`.

### RepoContextFactory change

Extending `RepoContextFactory.build` to accept a ready `RepoContext` is in scope
for this sub-issue. Update `core/spec/lib/context/RepoContextFactory_spec.js` and
the `core/spec/support/factories/repoContextFactory.js` support factory
accordingly.

## Benefits

- Consistency with the pattern already established by #309 / #310.
- Removes per-command context re-derivation and the two internal
  context-builder work-arounds.
- Aligns `AutoFixAllWaitCi` / `AutoFixAllWaitCiAndMerge` `repoPath` validation
  with the other three commands, shrinking the surface #314 has to unify.
- Moves the batch one step closer to the sub-issue 6 (#314) cleanup that drops
  the `takesRepoContext` flag and the `commandArgs()` branch entirely.

## Out of scope

`SpawnIssue` / `AutoFixAllGithub` (#312), resolve/fetch + remaining context
commands (#313), flag removal + centralised `repoPath` validation (#314).
