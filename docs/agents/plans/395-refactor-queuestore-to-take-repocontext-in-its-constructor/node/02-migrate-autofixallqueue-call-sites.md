# Migrate AutoFixAllQueue call sites

Update `AutoFixAllQueue` (`core/lib/commands/auto-fix-all/AutoFixAllQueue.js`) to
construct its `queueStore` default dependency as `new QueueStore(this._repoContext)`
instead of `new QueueStore()`. Since `queueStore` is an injectable default-parameter
(`deps.queueStore = new QueueStore()`), the constructor default itself can't reference
`this._repoContext` (not yet assigned when defaults evaluate) — assign the
`repoContext`-bound `QueueStore` explicitly in the constructor body instead, or move the
default's construction after `this._repoContext` is set, whichever keeps the existing
`deps.queueStore` override for specs working unchanged.

Then drop `this._repoContext.repoPath` from every call site that passes it to
`queueStore.read`, `queueStore.write`, `queueStore.lockFile` — in `save`, `next`,
`waitNext`, `push`, and `pop` — relying on the `repoContext` now injected at
`QueueStore` construction (per step 01's fallback).

## Files to Change

- `core/lib/commands/auto-fix-all/AutoFixAllQueue.js` — construct `QueueStore` with
  `this._repoContext`; remove `this._repoContext.repoPath` from all `queueStore.read` /
  `queueStore.write` / `queueStore.lockFile` call sites in `save`, `next`, `waitNext`,
  `push`, `pop`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` — update any expectations
  that assert `queueStore.read`/`write`/`lockFile` were called with `repoPath` as an
  argument, and any assertion on how the default `QueueStore` is constructed, to match the
  new `repoContext`-only call shape.
