# Issue: Refactor AutoFixAllQueue

## Description
`core/lib/AutoFixAllQueue.js` (488 lines, 18 KB) accumulates four responsibilities in a single class: queue persistence to a JSON file, queue CRUD operations, GitHub label mutation via REST API, and direct stdout/stderr I/O. This issue extracts two of those responsibilities into separate modules, following the generic-module pattern already established in `core/lib/` (e.g., `Lock.js`, `Origin.js`, `GithubToken.js`).

## Problem
Mixing queue CRUD, file I/O, and GitHub label mutation in one class makes each responsibility harder to test in isolation, and prevents the label-mutation logic from being reused by future skills that need it outside the queue context.

## Expected Behavior
No functional change: `AutoFixAllQueue`'s public API (`save`, `next`, `waitNext`, `push`, `pop`, `empty`, `list`) and its exact stdout/stderr output stay identical — this is a pure internal decomposition, validated by the existing integration test continuing to pass unmodified beyond the extraction.

## Solution

### Modules to extract

#### `IssueTagger.js`

Extract all GitHub label mutation logic:

- `_markEnqueued` → `markEnqueued`
- `_mutateTag` → `mutateTag`
- `_fetchLabels` → `fetchLabels`
- `_addLabel` → `addLabel`
- `_removeLabel` → `removeLabel`
- `_warnMutationFailure` → `warnMutationFailure`

`IssueTagger` is **generic** (not prefixed with `AutoFixAll`) so it can be reused by other skills in the future. Receives `origin`, `githubToken`, `fetchFn`, `timeoutMs` in the constructor. Keeps direct stdout/stderr writes (preserves the exact output order validated by current tests).

#### `QueueStore.js`

Extract the file I/O of the queue:

- `_readQueue` → `read`
- `_writeQueue` → `write`
- `_queueFile` → `queueFile`
- `_lockFile` → `lockFile`

Pure file I/O, no GitHub or lock dependencies. `AutoFixAllQueue` continues to coordinate the lock (acquire → read → write → release) since the read-modify-write transaction requires the external lock.

### `AutoFixAllQueue.js` after refactoring

Keeps only:

- CRUD: `save`, `next`, `waitNext`, `push`, `pop`, `empty`, `list`
- Coordination: calls `QueueStore` for I/O and `IssueTagger` for label mutation
- Lock: acquire/release for `push`/`pop`
- Own I/O: `Queue saved:`, `Pushed:` to stdout

### Dependency injection

`IssueTagger` and `QueueStore` are injected into `AutoFixAllQueue`'s constructor (defaults: `new IssueTagger(...)`, `new QueueStore()`), following the existing injection pattern in the module (lock, origin, githubToken, fetchFn, sleepFn). This preserves testability — test overrides allow mocking each component in isolation.

### Tests

- `AutoFixAllQueue_spec.js` — kept as integration test (Queue + IssueTagger + QueueStore together)
- `IssueTagger_spec.js` — new, isolated unit test
- `QueueStore_spec.js` — new, isolated unit test
- `fakeFetch` and `captureStdout` extracted to `core/spec/support/` for reuse

### Not included in this issue

- Extracting stdout/stderr I/O into a separate class (`QueueOutput`) — out of scope
- `--quiet` or `--json` mode — future feature

## Benefits
- Each responsibility (persistence, label mutation, coordination) becomes independently unit-testable, rather than only reachable through the combined integration test.
- `IssueTagger` becomes reusable by future skills that need GitHub label mutation, without depending on queue internals.
- Matches the established generic-module pattern (`Lock`, `Origin`, `GithubToken`) already used elsewhere in `core/lib/`, keeping the codebase consistent.
