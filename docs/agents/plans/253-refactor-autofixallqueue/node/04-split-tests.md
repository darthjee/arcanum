# Split and Isolate the Tests

Extract the two test helpers `AutoFixAllQueue_spec.js` currently defines locally into shared support files, then add isolated unit specs for the two new classes.

- `core/spec/support/utils/fakeFetch.js` (or alongside the existing `utils/` helpers, matching their export convention) — move `fakeFetch({ existingLabels, getFails, mutateFails })` from `AutoFixAllQueue_spec.js` verbatim.
- `core/spec/support/utils/captureStdout.js` — move `captureStdout(fn)` from `AutoFixAllQueue_spec.js` verbatim.
- Update `AutoFixAllQueue_spec.js` to import both from `core/spec/support/`, keeping it as the integration test for `AutoFixAllQueue` + `QueueStore` + `IssueTagger` working together (real, non-mocked collaborators, only `fetchFn` faked) — no behavioral change to its assertions.
- New `core/spec/lib/QueueStore_spec.js` — isolated unit test for `read`/`write`/`queueFile`/`lockFile`, covering the same cases `AutoFixAllQueue_spec.js` exercises indirectly today (absent file, empty file, non-empty file, malformed JSON, directory creation).
- New `core/spec/lib/IssueTagger_spec.js` — isolated unit test for `markEnqueued`/`mutateTag`/`fetchLabels`/`addLabel`/`removeLabel`/`warnMutationFailure`, using the shared `fakeFetch`, covering the same cases exercised indirectly today (already-present/absent label, fetch failure, mutate failure, origin/token resolution failure → `DispatchFailure`).

## Files to Change
- `core/spec/support/utils/fakeFetch.js` — new, shared fake-fetch helper.
- `core/spec/support/utils/captureStdout.js` — new, shared stdout-capture helper.
- `core/spec/lib/AutoFixAllQueue_spec.js` — import the two helpers instead of defining them locally; otherwise unchanged.
- `core/spec/lib/QueueStore_spec.js` — new isolated unit test.
- `core/spec/lib/IssueTagger_spec.js` — new isolated unit test.
