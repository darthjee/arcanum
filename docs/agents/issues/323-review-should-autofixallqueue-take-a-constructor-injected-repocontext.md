# Issue: Review: should AutoFixAllQueue take a constructor-injected RepoContext?

## Description

Standalone code-review question spun off from #308's dispatch refactor, filed
originally as a blocker for #314. **That framing is stale.** #321 replaced the
`takesRepoContext` boolean with the `context: 'repo' | 'claude' | 'none'` enum
in `core/lib/core/commands.js` / `core/lib/core/dispatcher.js`, and #314 shipped
as scaffold teardown without waiting on any per-command review. `context: 'none'`
(absent) is now a permanent first-class state, not an "exempt" hack. So this is
a review on its own merits: does giving `AutoFixAllQueue` a constructor-injected
`RepoContext` improve the code?

Covers the seven `auto-fix-all-queue-*` commands — `save`, `next`, `wait-next`,
`push`, `pop`, `empty`, `list` (`core/lib/commands/AutoFixAllQueue.js`).

**Outcome of the review: migrate.** Unlike the sibling review #322
(`AutoFixAllConfig`, closed no-change), `AutoFixAllQueue` already imports
`RepoContext` and builds one by hand inside `save` / `push`, and it genuinely
touches GitHub — so injection removes real duplication and `RepoContext` is the
right abstraction here.

### Current state

- Registry entries (`core/lib/core/commands.js`) carry no `context` key
  (≡ `context: 'none'`): constructed with `new AutoFixAllQueue()`, args
  untouched, so each method receives `repoPath` as its leading argument.
- Constructor is `constructor({ lock, queueStore, origin, githubToken, fetchFn,
  timeoutMs, issueTaggerFactory, pollIntervalMs, sleepFn } = {})`. `origin` and
  `githubToken` exist **only** to be threaded into the per-call `RepoContext`
  that `_issueTagger()` builds.
- Every method takes `repoPath` first and uses it to resolve
  `.claude/state/auto-fix-all-queue.json` (and its `.lock`) via `QueueStore`.
- `save` / `push` additionally do a best-effort GitHub issue-tag mutation
  (`enqueued` added, `ready_for_work` / `created` removed). For that,
  `_issueTagger(repoPath)` builds
  `new RepoContext({ repoPath, origin: this._origin, githubToken: this._githubToken })`
  per call and hands it to `issueTaggerFactory`, whose default wraps an
  `IssueClient` built from `fetchFn` / `timeoutMs`.
- `list` / `next` / `pop` / `empty` / `waitNext` never touch git or GitHub.
- No queue subcommand validates `repoPath` today (present / directory /
  git-repo) — it is only ever used as a path prefix.
- Sibling precedent: the `auto-fix-all-github-*` family
  (`core/lib/commands/AutoFixAllGithub.js`) is already
  `constructor(repoContext, { repoContextFactory, issueTaggerFactory, ... })`,
  building per-call bundles via `RepoContextFactory#buildFromContext(this._repoContext)`.

## Problem

- `save` / `push` reconstruct a `RepoContext` on every call from `repoPath` +
  `origin` + `githubToken`, duplicating exactly what `Dispatcher` already does
  for `context: 'repo'` commands.
- `origin` and `githubToken` are constructor injection points that exist only to
  feed that hand-rolled `RepoContext` — noise a caller should not have to know
  about.
- The queue family diverges from its already-migrated sibling
  `auto-fix-all-github-*`, which reuses one injected `RepoContext` through
  `RepoContextFactory`.
- `RepoContext` genuinely fits here (the command hits GitHub via `origin` /
  `githubToken`), so the abstraction-mismatch reason that kept #322 exempt does
  not apply.

## Expected Behavior

- The seven `auto-fix-all-queue-*` registry entries carry `context: 'repo'`.
  `Dispatcher` builds `new RepoContext({ repoPath: args[0] })`, passes it to the
  constructor, forwards `args.slice(1)` to the method, and runs
  `RepoContext#validate()` on `args[0]` before dispatch — validation left on for
  all seven (see Solution).
- `AutoFixAllQueue` constructor becomes `constructor(repoContext, { ...deps } = {})`;
  `origin` / `githubToken` are dropped from `deps`.
- Every method loses its leading `repoPath` parameter and reads
  `this._repoContext.repoPath` instead.
- `save` / `push` reuse the injected `RepoContext` for tag mutation — no
  `new RepoContext(...)` anywhere in the file.
- The per-call `IssueTagger` is built via a `RepoContextFactory` bundle,
  mirroring `AutoFixAllGithub`:
  `issueTaggerFactory = (bundle) => new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient })`,
  called with `this._repoContextFactory.buildFromContext(this._repoContext)`.
- No behavior change to queue-file semantics, the lock transaction, stdout
  ordering, or the best-effort nature of tag mutation.
- Callsites (`auto-fix-all/scripts/queue_*_shell.sh`, skill `.md` steps) pass
  `repoPath` leading already, so `args.slice(1)` lines up with zero changes
  there.
- Full `core/spec` suite green.

## Solution

### `core/lib/core/commands.js`

- Add `context: 'repo'` to `auto-fix-all-queue-empty` / `-list` / `-next` /
  `-pop` / `-push` / `-save` / `-wait-next`.
- Do **not** set `validateRepoPath: false` — let `Dispatcher` run
  `RepoContext#validate()` for all seven. The queue and its state file always
  live inside a real repo checkout; validating up front (including for the
  long-polling `wait-next`) fails fast instead of surfacing a confusing
  `QueueStore` path error later. Matches the `auto-fix-all-github-*` family.
- Update the top-of-file `@property {'repo'|'claude'|'none'} [context]` doc
  comment: move `auto-fix-all-queue-*` out of the `'none'` list and into the
  `'repo'` list.

### `core/lib/commands/AutoFixAllQueue.js`

- Constructor →
  `constructor(repoContext, { lock = new Lock(), queueStore = new QueueStore(), repoContextFactory = new RepoContextFactory(), issueTaggerFactory = (bundle) => new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient }), pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, sleepFn = defaultSleep } = {})`.
  Store `this._repoContext` / `this._repoContextFactory`; drop `this._origin` /
  `this._githubToken`. `fetchFn` / `timeoutMs` move onto `RepoContextFactory`'s
  own knobs (it owns `IssueClient` construction), so drop them from
  `AutoFixAllQueue`'s `deps`.
- `save(...ids)` / `push(...ids)` / `next()` / `waitNext()` / `pop()` /
  `empty()` / `list()` — drop the `repoPath` parameter; replace `repoPath` with
  `this._repoContext.repoPath` in every `this._queueStore` call and in
  `lockFile(...)`.
- `_issueTagger()` — drop the `repoPath` param and the `new RepoContext({...})`;
  `return this._issueTaggerFactory(this._repoContextFactory.buildFromContext(this._repoContext));`.
  Update its doc comment (no more per-call context construction; the bundle is
  the cheap zero-I/O per-call piece).
- Update the class-level JSDoc and the `@param` block to describe the injected
  `repoContext` + `repoContextFactory`, matching `AutoFixAllGithub`'s wording.
- Imports: drop `GithubToken`, `Origin`, `RepoContext` (and `IssueClient`, no
  longer referenced by the default factory); add `RepoContextFactory`.

### Tests — `core/spec/lib/commands/AutoFixAllQueue_spec.js`

- Construct with a `RepoContext` from
  `core/spec/support/factories/repoContextFactory.js`
  (`createRepoContextMock({ repoPath })`) as the first arg; move the `repoPath`
  currently passed per method call into that fixture.
- Replace `origin` / `githubToken` stub injection with a stubbed
  `repoContextFactory` whose `buildFromContext` returns a bundle
  `{ context, issueClient }`, and/or a stubbed `issueTaggerFactory` receiving
  that bundle.
- Assert `save` / `push` call `issueTaggerFactory` with the bundle built from
  the injected context (not a freshly constructed `RepoContext`).
- Keep coverage of: no-ids throw, stdout line ordering, the lock
  acquire/read/write/release sequence for `push` / `pop`, `empty`'s
  `DispatchFailure('', 1)`, `waitNext`'s poll loop, `list`'s `(empty)` output.
- `core/spec/lib/core/commands_spec.js` / `dispatcher_spec.js` — if either
  asserts the `context` value or the arg-strip behavior per command, extend the
  `context: 'repo'` expectations to the seven queue entries.

### Out of scope

- No change to `QueueStore`, `Lock`, `IssueTagger`, `IssueClient`, or
  `TagMutationService`.
- No change to `auto-fix-all/scripts/queue_*_shell.sh` or the skill `.md` steps
  — they already pass `repoPath` leading.

## Benefits

- Removes the hand-rolled per-call `RepoContext` construction from `save` /
  `push`; one injected context, reused.
- Drops two constructor injection points (`origin`, `githubToken`) that existed
  only to feed that construction.
- Aligns the `auto-fix-all-queue-*` family with the already-migrated
  `auto-fix-all-github-*` family — same `constructor(repoContext, ...)` +
  `RepoContextFactory#buildFromContext` shape.
- `repoPath` validation now happens once, up front, through the shared
  `Dispatcher` path instead of never.
- Zero callsite churn — the shell / skill wiring already matches.

## Relation to #308 / #314

Does not block anything. #321 and #314 are closed; #314 shipped without this
review. Sibling reviews: #322 (`AutoFixAllConfig`) closed no-change; #324
(`ArcanumUpdateRunUpdate`) still open. This issue is the one in the group that
concludes *migrate*, because `AutoFixAllQueue` already builds a `RepoContext`
internally and genuinely uses GitHub.
