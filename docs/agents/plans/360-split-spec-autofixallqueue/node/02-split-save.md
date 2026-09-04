# Split save tests into AutoFixAllQueueSave_spec.js

Create `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js` under a top-level
`describe('AutoFixAllQueue (save)', ...)`, moving the current `#save` `describe` block
(`AutoFixAllQueue_spec.js:59-135`) into it verbatim — same `it`s, same assertions, same
`beforeEach`/`afterEach` (temp dir + `queueFile`/`lockFile` derivation via `createTempDir`/
`removeTempDir`).

Import `createAutoFixAllQueue`, `writeQueueFile`, `readQueueFile` from the step-01 factory
(`../../../support/factories/autoFixAllQueue.js`) instead of redefining them locally; keep
direct imports for whatever this block also uses on its own (e.g. `DispatchFailure`,
`fakeFetch`, `captureStdout`, `createTempDir`/`removeTempDir`).

The original `AutoFixAllQueue_spec.js` is left untouched — it still holds its own `#save` block
until step 05 deletes the whole file, so the suite temporarily runs that block from both places.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js` (new) — `#save`, moved
  verbatim from the original spec.
