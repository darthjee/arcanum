# Split read-only tests into AutoFixAllQueueReads_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueReads_spec.js` under a top-level
`describe('AutoFixAllQueue (reads)', ...)`, moving the three read-only `describe` blocks
verbatim: `#next` (`AutoFixAllQueue_spec.js:135-160`), `#waitNext` (`:160-190`), and `#list`
(`:333-357`) — same `it`s, same assertions, same per-block setup.

Import `createAutoFixAllQueue`, `writeQueueFile`, `readQueueFile` from the step-01 factory
(`../../../support/factories/autoFixAllQueue.js`); keep direct imports for anything else this
block uses on its own.

The original `AutoFixAllQueue_spec.js` is left untouched — it still holds these three blocks
until step 05 deletes the whole file, so the suite temporarily runs them from both places.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueReads_spec.js` (new) — `#next`,
  `#waitNext`, `#list`, moved verbatim from the original spec.
