# Refactor AutoFixAllQueue to Delegate

Update `core/lib/AutoFixAllQueue.js` to drop the extracted methods and delegate to `QueueStore`/`IssueTagger` instead.

Constructor gains two new injectable dependencies, defaulting to real instances — same pattern as the existing `lock`/`origin`/`githubToken`/`fetchFn` injection:

```js
constructor({
  lock = new Lock(),
  queueStore = new QueueStore(),
  issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs }),
  ...
} = {}) { ... }
```

(exact default-wiring order needs `origin`/`githubToken`/`fetchFn`/`timeoutMs` still accepted as constructor options too, so a caller can override just the label-mutation transport without also passing a whole custom `issueTagger` — check existing spec usage in step 04 before finalizing which options must remain top-level vs. move fully into `issueTagger`'s own construction.)

Replace call sites:
- `this._readQueue(repoPath)` → `this._queueStore.read(repoPath)`
- `this._writeQueue(repoPath, entries)` → `this._queueStore.write(repoPath, entries)`
- `this._queueFile(repoPath)` → `this._queueStore.queueFile(repoPath)`
- `this._lockFile(repoPath)` → `this._queueStore.lockFile(repoPath)`
- `this._markEnqueued(repoPath, ids)` → `this._issueTagger.markEnqueued(repoPath, ids)`

Keep unchanged: `save`, `next`, `waitNext`, `push`, `pop`, `empty`, `list` bodies (only their internal calls change per above), the lock acquire/read/write/release sequencing in `push`/`pop`, and the `Queue saved: ...`/`Pushed: ...` stdout writes.

Remove now-dead code: `TAG_TO_LABEL`, `LABEL_TO_TAG` import, `DEFAULT_TIMEOUT_MS`, and the six moved private methods.

## Files to Change
- `core/lib/AutoFixAllQueue.js` — delegate to `QueueStore`/`IssueTagger`, drop the moved methods and now-unused constants/imports.
