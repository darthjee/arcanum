# Split pop/empty tests into AutoFixAllQueuePop_spec.js and delete the original

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js` under a top-level
`describe('AutoFixAllQueue (pop & empty)', ...)`, moving the two remaining blocks verbatim:
`#pop` (`AutoFixAllQueue_spec.js:263-300`) and `#empty` (`:300-333`).

Import `createAutoFixAllQueue`, `writeQueueFile`, `readQueueFile` from the step-01 factory
(`../../../support/factories/autoFixAllQueue.js`); keep direct imports for anything else this
block uses on its own.

Now that all seven `describe` blocks (`#save`, `#next`, `#waitNext`, `#push`, `lock
contention`, `#pop`, `#empty`) live in one of the four new sibling files, **delete**
`core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` in this same step — every `it`
now exists exactly once again, distributed across the four new files instead of duplicated.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js` (new) — `#pop`, `#empty`,
  moved verbatim from the original spec.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` (deleted) — fully superseded by
  the four new sibling files.
