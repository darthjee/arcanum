# Split push tests into AutoFixAllQueuePush_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js` under a top-level
`describe('AutoFixAllQueue (push)', ...)`, moving two blocks verbatim: `#push`
(`AutoFixAllQueue_spec.js:190-263`) and the whole `lock contention` block (`:357-385`) — both
of its `it`s, including the push/pop-overlap test, stay together in this one block (decided
during discussion: do not split `lock contention` across files even though its second test also
exercises `#pop`).

Import `createAutoFixAllQueue`, `writeQueueFile`, `readQueueFile` from the step-01 factory
(`../../../support/factories/autoFixAllQueue.js`); keep a direct import for `Lock` (used
directly by both `lock contention` tests to construct a shared lock) and anything else this
block uses on its own.

The original `AutoFixAllQueue_spec.js` is left untouched — it still holds these two blocks
until step 05 deletes the whole file, so the suite temporarily runs them from both places.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js` (new) — `#push` and
  `lock contention`, moved verbatim from the original spec.
