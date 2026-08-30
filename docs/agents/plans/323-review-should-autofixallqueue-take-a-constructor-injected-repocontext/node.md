# node Plan: Review: should AutoFixAllQueue take a constructor-injected RepoContext?

Issue: [323-review-should-autofixallqueue-take-a-constructor-injected-repocontext.md](../../issues/323-review-should-autofixallqueue-take-a-constructor-injected-repocontext.md)

## Overview

`AutoFixAllQueue` is the one command in the #308 per-command review series that
comes out *migrate*: unlike `AutoFixAllConfig` (#322, closed no-change), it
already imports `RepoContext` and builds one per call inside `save` / `push`,
and it genuinely talks to GitHub. Injecting the context removes that hand-rolled
construction and the `origin` / `githubToken` constructor deps that exist only to
feed it, and aligns the family with the already-migrated `auto-fix-all-github-*`
family (`AutoFixAllGithub` + `RepoContextFactory#buildFromContext`).

## Context

Current state (verified in the codebase):

- `core/lib/core/commands.js` — the seven `auto-fix-all-queue-*` entries
  (`empty` / `list` / `next` / `pop` / `push` / `save` / `wait-next`) carry no
  `context` key (≡ `context: 'none'`): `Dispatcher` does `new AutoFixAllQueue()`
  and forwards args untouched, so each method gets `repoPath` as its leading
  argument.
- `core/lib/commands/AutoFixAllQueue.js` — `constructor({ lock, queueStore,
  origin, githubToken, fetchFn, timeoutMs, issueTaggerFactory, pollIntervalMs,
  sleepFn } = {})`. `origin` / `githubToken` are only ever threaded into the
  per-call `RepoContext` that `_issueTagger(repoPath)` builds
  (`new RepoContext({ repoPath, origin: this._origin, githubToken: this._githubToken })`).
  The default `issueTaggerFactory` wraps an `IssueClient` built from
  `fetchFn` / `timeoutMs`.
- `save` / `push` do a best-effort GitHub issue-tag mutation via that per-call
  `IssueTagger` (`markEnqueued`). `list` / `next` / `pop` / `empty` / `waitNext`
  never touch git or GitHub — they only resolve
  `.claude/state/auto-fix-all-queue.json` (+ `.lock`) through `QueueStore`.
- Precedent — `core/lib/commands/AutoFixAllGithub.js`:
  `constructor(repoContext, { repoContextFactory = new RepoContextFactory(),
  issueTaggerFactory = (bundle) => new IssueTagger({ context: bundle.context,
  issueClient: bundle.issueClient }), branchCleanup } = {})`, with per-call
  delegates built from `this._repoContextFactory.buildFromContext(this._repoContext)`.
- `RepoContextFactory#buildFromContext(context)` returns a flat six-key bundle
  `{ context, gitClient, gitBranch, git, githubClient, issueClient }`, reusing
  the passed context verbatim; only its `execFileAsync` / `fetchFn` / `timeoutMs`
  knobs are consulted on that path.
- `Dispatcher` (`core/lib/core/dispatcher.js`) for a `context: 'repo'` entry:
  builds `new RepoContext({ repoPath: args[0] })`, passes it to the constructor,
  forwards `args.slice(1)`, and — unless `validateRepoPath: false` — calls
  `repoContext.validate()` (present / directory / **git repository**) on
  `args[0]` before importing the command module. `github-issue-info` is the
  existing `validateRepoPath: false` precedent.

### Parity constraint (drives the `validateRepoPath` split)

`core/spec/bin/autoFixAllQueueParity/*` asserts byte-identical stdout + exit code
between the shell entrypoints and the native commands:

- `save` / `push` parity fixtures are real git repos (`setupParityTest` →
  `createGitFixtureRepo`), so `RepoContext#validate()` passes — validation stays
  on.
- `list` / `next` / `pop` / `empty` / `wait-next` parity fixtures are plain
  `createTempDir()` directories (not git repos). The shell scripts do no
  git-repo check, so if the native side validated it would throw
  "not a git repository" and break parity on the happy path. These five entries
  must therefore be `validateRepoPath: false`.

This refines the issue's "validate all seven" line: all seven get
`context: 'repo'`, but only `save` / `push` keep the Dispatcher validation.

## Steps

- [01 — Registry: context and validateRepoPath](node/01-registry-context-and-doc.md)
- [02 — AutoFixAllQueue: constructor-injected RepoContext](node/02-autofixallqueue-constructor-injection.md)
- [03 — Rework AutoFixAllQueue_spec](node/03-rework-autofixallqueue-spec.md)
- [04 — Registry spec + parity check](node/04-registry-and-parity-specs.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `lint`)

## Notes

- No changes to `auto-fix-all/scripts/queue_*_shell.sh` or any skill `.md` step —
  they already pass `repoPath` as the first arg after the subcommand, so
  `Dispatcher`'s `args.slice(1)` lines up.
- No changes to `QueueStore`, `Lock`, `IssueTagger`, `IssueClient`,
  `TagMutationService`, or `Tags`.
- No other code constructs `AutoFixAllQueue` directly (unlike `AutoFixAllGithub`,
  which `AutoFixAllWaitCiAndMerge` instantiates) — the only caller is
  `Dispatcher`, so the constructor signature change is self-contained.
- Behaviour preserved: queue-file semantics, the lock acquire → read → write →
  release transaction, stdout line ordering, and the best-effort (never-throwing
  except `DispatchFailure` on origin/token resolution failure) nature of the tag
  mutation.
- Risk: the `validateRepoPath` split means `save` / `push` now fail fast with the
  `repo_path_enter` message when run outside a git repo, where before they would
  have proceeded to a queue write and only failed at the GitHub step. This is an
  improvement (they always needed a real repo for the tag mutation) and the
  `save` / `push` parity fixtures already run in git repos, so parity holds.
