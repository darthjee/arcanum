# Node Plan: Codacy: duplication cluster — IssueStateService Set/Write/AppendJson spec trio (60 clone groups, 3 files)

Main plan: [plan.md](plan.md)

## Overview
Three `IssueStateService` specs — `IssueStateServiceSet_spec.js` (`#set`, `#setJson`), `IssueStateServiceWrite_spec.js` (`#write`, `#get`), and `IssueStateServiceAppendJson_spec.js` (`#appendJson`) — duplicate a 21-line setup preamble plus three assertion patterns (lock acquire/release, concurrent-write safety, merge semantics) across and within files. Codacy reports 60 clone groups / ~120 duplicated lines across the trio.

## Context
- `core/spec/support/sharedExamples/` already holds this repo's shared-example convention: a module exporting `itXxx(description, ..., prepare, assertions)` functions that internally register their own `describe`/`it` blocks and are called from each spec (see `engineDispatchRouting.js`).
- Duplication breakdown found by direct inspection:
  - Setup preamble (imports, `beforeEach`/`afterEach` building a temp repo dir via `createTempDir`/`removeTempDir`, `RepoContext`, and the `stateFile` path) — identical across all three files.
  - "acquires and releases the lock file around the write" — duplicated 4x (Set `#set`, Set `#setJson`, Write `#write`, AppendJson), differing only in the mutation call made.
  - "does not corrupt state under two near-simultaneous mutations to the same issue" — duplicated 3x (Set `#set`, Write `#write`, AppendJson), differing in the mutation call and expected merged fields.
  - "merges into (rather than replaces) any pre-existing state" — duplicated 3x (Set `#set`, Set `#setJson`, Write `#write`).
- `#get` tests in `IssueStateServiceWrite_spec.js` and the field-specific happy-path tests (e.g. "overwrites an existing field", "creates a one-element array when the field does not exist yet") are NOT part of the duplication cluster — they exercise distinct behavior per method and stay as-is, untouched by this refactor.

## Implementation Steps

### Step 1 — Add the shared examples module
Create `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js`, exporting:
- A shared setup helper (e.g. `setUpIssueStateFixture()`) returning `{ repoPath, context, stateFile, lockFile }`, called from each spec's own `beforeEach`/`afterEach` (each spec still needs its own `describe` block and local `repoPath`/`context`/`stateFile` variables, so this can be a plain helper function rather than a `describe`-registering `itXxx`).
- `itAcquiresAndReleasesTheLock(mutate)` — registers the "acquires and releases the lock file around the write" `it`, where `mutate(issueStateService)` performs the spec-specific call (`.set(...)`, `.setJson(...)`, `.write(...)`, or `.appendJson(...)`).
- `itDoesNotCorruptStateUnderConcurrentMutations(mutateA, mutateB, assertMerged)` — registers the concurrent-write-safety `it`, taking the two concurrent mutation calls and a callback asserting the merged result.
- `itMergesIntoExistingState(mutateFirst, mutateSecond, expectedMerged)` — registers the "merges into (rather than replaces) any pre-existing state" `it`.

Follow `engineDispatchRouting.js`'s JSDoc-comment convention documenting each exported function's parameters.

### Step 2 — Refactor the three spec files to use the shared examples
Update `IssueStateServiceSet_spec.js`, `IssueStateServiceWrite_spec.js`, and `IssueStateServiceAppendJson_spec.js`:
- Replace the duplicated `beforeEach`/`afterEach` preamble with the shared setup helper from Step 1.
- Replace each spec's "acquires and releases the lock", "concurrent-write safety", and "merge semantics" `it` blocks with calls to the corresponding shared example, passing in the spec's own mutation call(s) and expected result.
- `IssueStateServiceSet_spec.js` calls the lock and merge-semantics shared examples twice — once under `#set`, once under `#setJson` — since both were independently duplicated in the original file.
- Leave every other `it` (method-specific happy-path behavior, `#get`) untouched.
- Run `yarn test` (see CI Checks below) and confirm all three specs still pass with unchanged assertions/coverage.

## Files to Change
- `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js` — new shared setup helper + parameterized shared examples (lock, concurrency, merge semantics).
- `core/spec/lib/services/IssueStateServiceSet_spec.js` — use shared setup + shared examples for `#set` and `#setJson`.
- `core/spec/lib/services/IssueStateServiceWrite_spec.js` — use shared setup + shared examples for `#write`; `#get` tests unchanged.
- `core/spec/lib/services/IssueStateServiceAppendJson_spec.js` — use shared setup + shared examples.

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking — confirms the duplication score actually drops)

## Notes
- Keep each shared example's parameters minimal and close to the existing call shapes (`issueStateService.set('42', 'title', 'X')` etc.) so the refactored specs stay as readable as the originals — this is a pure test-structure refactor, no production code under `core/lib/` changes.
