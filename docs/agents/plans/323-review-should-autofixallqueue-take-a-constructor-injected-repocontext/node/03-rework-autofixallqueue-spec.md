# Rework AutoFixAllQueue_spec

Update `core/spec/lib/commands/AutoFixAllQueue_spec.js` for the new constructor
shape: pass a fake-backed `RepoContext` as the first arg, move the per-call
`dir` argument off every method call, and re-express the origin/token failure
tests through the injected context.

## `newQueue` helper

Model it on `AutoFixAllGithub_spec.js`'s `newGithub`:

```js
function newQueue(overrides = {}) {
  const {
    repoPath = dir,
    origin = { resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
    githubToken = { get: async () => TOKEN },
    fetchFn = fakeFetch(),
    ...rest
  } = overrides;

  const repoContext = new RepoContext({ repoPath, origin, githubToken });

  return new AutoFixAllQueue(repoContext, {
    lock: new Lock({ sleepMs: 5 }),
    repoContextFactory: new RepoContextFactory({ fetchFn }),
    pollIntervalMs: 5,
    sleepFn: async () => {},
    ...rest
  });
}
```

- Import `RepoContext` from `../../../lib/context/RepoContext.js` and
  `RepoContextFactory` from `../../../lib/context/RepoContextFactory.js`.
- `repoPath` defaults to `dir` (the temp dir created in `beforeEach`), so it
  still points at the real on-disk queue file.
- Keep `REPO` / `TOKEN` consts and the `fakeFetch` import.

## Call-site edits

Remove the leading `dir` argument from every `queue.<method>(dir, ...)` call
throughout the file:

- `queue.save(dir, '1', '2', '3')` → `queue.save('1', '2', '3')`
- `queue.save(dir)` → `queue.save()`
- `queue.push(dir, '1')` → `queue.push('1')`, etc.
- `queue.next(dir)` → `queue.next()`; same for `waitNext` / `pop` / `empty` /
  `list`.
- The `lock contention` block's `first.push(dir, 'a', 'b')` /
  `popper.pop(dir)` calls lose their `dir` arg too. Those helpers build two
  `AutoFixAllQueue` instances sharing one `Lock`; keep that, just via `newQueue`
  passing the shared `lock` through `...rest` and the same default `repoPath`
  (`dir`), so both instances resolve the same `lockFile`.

## Origin/token failure tests

The two "rejects with a DispatchFailure ... when resolving the origin/token
itself fails" tests currently pass `origin: { resolveWithRef: async () => { throw ... } }`
to `newQueue`. With the helper above that override flows into the `RepoContext`,
so `markEnqueued`'s resolution still throws and the assertions
(`DispatchFailure`, `stdout === ''`, `exitCode === 1`, confirmation line already
printed) hold unchanged.

## Label-mutation tests

`#save` "best-effort attempts the label mutation for every given id" and the
stderr-warning tests assert on `fetchFn` calls / `process.stderr.write`. They
keep working as long as `fetchFn` reaches the per-call `IssueClient` — which it
does via `new RepoContextFactory({ fetchFn })` in `newQueue`. No assertion
changes; only the `queue.save(dir, ...)` → `queue.save(...)` edit.

Optionally add one assertion that `save` / `push` build the tagger from the
injected context: spy on `repoContextFactory.buildFromContext` and expect it
called with the same `RepoContext` instance passed to the constructor.

## Files to Change

- `core/spec/lib/commands/AutoFixAllQueue_spec.js` — `newQueue` helper, drop the
  leading `dir` arg from all method calls, new imports.
