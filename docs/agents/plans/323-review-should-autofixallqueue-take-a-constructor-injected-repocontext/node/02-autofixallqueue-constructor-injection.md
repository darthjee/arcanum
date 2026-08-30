# AutoFixAllQueue: constructor-injected RepoContext

Rework `core/lib/commands/AutoFixAllQueue.js` to receive a `RepoContext` as its
first constructor argument (matching `AutoFixAllGithub`), drop the leading
`repoPath` parameter from every method, and build the per-call `IssueTagger` off
a `RepoContextFactory` bundle wrapping the injected context — no more
hand-rolled `new RepoContext(...)`.

## Constructor

Change to:

```js
constructor(repoContext, {
  lock = new Lock(),
  queueStore = new QueueStore(),
  repoContextFactory = new RepoContextFactory(),
  issueTaggerFactory = (bundle) => new IssueTagger({
    context: bundle.context,
    issueClient: bundle.issueClient
  }),
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  sleepFn = defaultSleep
} = {}) {
  this._repoContext = repoContext;
  this._lock = lock;
  this._queueStore = queueStore;
  this._repoContextFactory = repoContextFactory;
  this._issueTaggerFactory = issueTaggerFactory;
  this._pollIntervalMs = pollIntervalMs;
  this._sleep = sleepFn;
}
```

- Remove `origin`, `githubToken`, `fetchFn`, `timeoutMs` from the destructured
  deps and the corresponding `this._origin` / `this._githubToken` fields. The
  `fetchFn` / `timeoutMs` knobs now live on `RepoContextFactory` (callers that
  need to stub the REST transport pass a pre-built `repoContextFactory`, exactly
  as `AutoFixAllGithub_spec.js`'s `newGithub` does).

## Methods

Drop the leading `repoPath` parameter from `save` / `push` / `next` / `waitNext`
/ `pop` / `empty` / `list`. Everywhere a method currently passes `repoPath` to
`this._queueStore.read` / `.write` / `.lockFile`, pass
`this._repoContext.repoPath` instead. Signatures become:

- `async save(...ids)` / `async push(...ids)`
- `async next()` / `async waitNext()` / `async pop()` / `async empty()` /
  `async list()`

No change to any method body beyond the `repoPath` → `this._repoContext.repoPath`
substitution and the `_issueTagger()` call below. The no-ids `throw`, stdout
writes and ordering, lock transaction, `DispatchFailure('', 1)` cases, and
poll loop stay exactly as they are.

## `_issueTagger`

Replace the current body (which builds `new RepoContext({ repoPath, origin,
githubToken })`) with:

```js
_issueTagger() {
  return this._issueTaggerFactory(
    this._repoContextFactory.buildFromContext(this._repoContext)
  );
}
```

Update the two `save` / `push` call sites from `this._issueTagger(repoPath)` to
`this._issueTagger()`. Rewrite the method's doc comment: it no longer constructs
a context per call — it wraps the injected `RepoContext` into a fresh
zero-I/O `RepoContextFactory` bundle per call (mirroring
`AutoFixAllGithub#_issueTagger`), and reads `.context` / `.issueClient` off it.

## Imports and JSDoc

- Remove imports: `GithubToken`, `Origin`, `RepoContext`, and `IssueClient`
  (no longer referenced once the default `issueTaggerFactory` takes `issueClient`
  from the bundle).
- Add import: `RepoContextFactory` from `../context/RepoContextFactory.js`.
- Update the class-level JSDoc and the `constructor` `@param` block to describe
  the injected `repoContext` (first positional) plus `repoContextFactory`,
  reusing `AutoFixAllGithub`'s wording. Keep the `save` / `push` doc notes about
  writing straight to `process.stdout` and the `DispatchFailure` contract.

## Files to Change

- `core/lib/commands/AutoFixAllQueue.js` — constructor signature + fields,
  per-method `repoPath` removal, `_issueTagger()` rewrite, imports, JSDoc.
