# Write unit tests

Write `core/spec/lib/AutoFixAllQueue_spec.js`, following the conventions already established in `core/spec/lib/AutoFixAllConfig_spec.js`/`AutoFixAllWaitCi_spec.js` (Jasmine, injected fakes/dummies for `Lock`/`Origin`/`GithubToken`/`fetch`, temp-dir fixtures under `core/spec/support/` for the queue/lock files). Cover all 7 methods:

- `save` — writes the exact given ids, overwriting any existing content; prints `Queue saved: <ids>`; best-effort calls the label mutation for each id (assert it's attempted, and that a mutation failure warns to stderr but doesn't throw).
- `next` — returns the first id when present; returns empty string when the queue is empty or the file is absent.
- `waitNext` — resolves immediately when the queue is already non-empty; polls (using an injected short `pollIntervalMs` and a fake/instant `sleepFn` — never a real multi-second wait) until an item appears, then resolves with it.
- `push` — appends to an existing queue; acquires/releases the lock around the mutation (assert via the injected `Lock` fake); prints `Pushed: <ids>`; best-effort label mutation, same as `save`.
- `pop` — removes the first entry, leaving the rest; acquires/releases the lock; no stdout.
- `empty` — resolves for a zero-length queue; throws `DispatchFailure('', 1)` for a non-empty queue.
- `list` — prints each id on its own line for a non-empty queue; prints `(empty)` for a zero-length queue.
- **Lock contention**: a scenario where the injected `Lock.acquire` sees contention (e.g. a fake that resolves only after N attempts, or two overlapping `push`/`pop` calls against a shared fake lock) to verify `push`/`pop` correctly serialize through `core/lib/Lock.js` rather than racing the queue file.

## Files to Change

- `core/spec/lib/AutoFixAllQueue_spec.js` — new, unit tests for all 7 methods.
