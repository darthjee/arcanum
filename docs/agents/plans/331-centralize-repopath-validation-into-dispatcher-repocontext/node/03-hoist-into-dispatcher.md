# Hoist the validation call into Dispatcher.dispatch()

Add the single validation call to `Dispatcher.dispatch()`
(`core/lib/core/dispatcher.js:45-56`), between `record` and `commandInstance()`:

```js
if (this.entry.log !== false) {
  await this._invocationLog.record(this.command);
}

if (
  this.entry.context === 'repo' &&
  this.entry.validateRepoPath !== false &&
  this.args[0]
) {
  await this.repoContext.validate();
}

const instance = await this.commandInstance();
```

Notes:

- Reading `this.repoContext` here just constructs the memoized `RepoContext` a
  few lines earlier than `commandInstance()` would — harmless (zero-I/O
  constructor, `??=` memoized, reused at `:68`).
- The `&& this.args[0]` guard keeps current shell parity for the absent-leading-
  arg case (the command's own `USAGE` throw still wins). Whether to drop this
  guard is **#333**'s call — leave a short comment pointing at #333.
- Order matters: after `record` (an invalid `repoPath` is still logged), before
  `await import()` in `commandInstance()` (`:66`).
- Update `dispatch()` / class JSDoc (`:15-21`, `:38-44`) to mention the
  `context: 'repo'` validation step.

## Files to Change

- `core/lib/core/dispatcher.js` — the guarded `await this.repoContext.validate()`
  statement in `dispatch()`; JSDoc touch-ups.
