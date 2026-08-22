# Unit tests for the new methods

Extend `core/spec/lib/IssueState_spec.js` (already covers `#write`) with `describe` blocks for `#get`, `#set`, `#setJson`, and `#appendJson`, using the same `createTempDir`/`removeTempDir` fixture helpers and `new Lock({ sleepMs: 5 })` pattern already in the file.

Cover at least:
- `#get` on a missing field / missing state file → resolves to `''`, never throws.
- `#get` on an existing field → resolves to its value.
- `#set` overwriting an existing field, and merging alongside untouched fields (same "merges into rather than replaces" shape as the existing `#write` tests).
- `#setJson` with an object value and with an array value.
- `#appendJson` on a field that doesn't exist yet (creates a one-element array) vs. one that's already an array (appends).
- Concurrent-write lock contention: two near-simultaneous `set`/`appendJson` calls against the same issue id don't corrupt the state file (mirror the existing "does not corrupt state under two near-simultaneous writes" test for `#write`).
- Lock acquire/release around each new method (mirror the existing `spyOn(lock, 'acquire'/'release')` test for `#write`).

## Files to Change

- `core/spec/lib/IssueState_spec.js` — add `describe('#get' | '#set' | '#setJson' | '#appendJson', ...)` blocks per above.
