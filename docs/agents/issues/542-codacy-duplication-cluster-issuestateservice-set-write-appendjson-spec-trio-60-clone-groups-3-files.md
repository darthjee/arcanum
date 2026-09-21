# Issue: Codacy: duplication cluster — IssueStateService Set/Write/AppendJson spec trio (60 clone groups, 3 files)

## Description
Three `IssueStateService` specs each exercise a different mutation method that funnels through the same underlying lock/read/merge/write protocol:

- `core/spec/lib/services/IssueStateServiceSet_spec.js` (`#set`, `#setJson`)
- `core/spec/lib/services/IssueStateServiceWrite_spec.js` (`#write`, `#get`)
- `core/spec/lib/services/IssueStateServiceAppendJson_spec.js` (`#appendJson`)

Codacy reports 60 clone groups and roughly 120 duplicated lines across the trio.

## Problem
- The 21-line setup preamble (imports, `beforeEach`/`afterEach` building a temp repo dir, `RepoContext`, and the `stateFile` path) is duplicated verbatim across all three files.
- The "acquires and releases the lock file around the write" assertion is duplicated 4 times (twice within the Set spec — once for `#set`, once for `#setJson` — once in Write, once in AppendJson), differing only in which mutation call is made.
- The "does not corrupt state under two near-simultaneous mutations to the same issue" concurrency test is duplicated 3 times (Set `#set`, Write `#write`, AppendJson), differing only in the mutation call and the expected merged fields.
- The "merges into (rather than replaces) any pre-existing state" test is duplicated 3 times (Set `#set`, Set `#setJson`, Write `#write`).

## Solution
- Add `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js`, following the existing shared-example convention in that folder (e.g. `engineDispatchRouting.js`'s exported `itXxx(...)` functions that register their own `describe`/`it` blocks).
- Extract the "acquires and releases the lock", "concurrent-write safety", and "merge semantics" assertions into parameterized shared example functions, each taking the mutation invocation (and expected result) as arguments so every spec supplies only its own `set`/`write`/`appendJson`/`setJson` call.
- Update all three spec files to call the shared examples in place of the duplicated blocks.

### Acceptance criteria
- [ ] `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js` exists and is used by all three specs.
- [ ] The duplicated preamble and the lock/concurrency/merge-semantics assertion blocks are removed from each file in favor of the shared examples.
- [ ] All three specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this trio drops substantially after the fix lands.

## Benefits
- Collapses ~120 duplicated lines into a single shared source of truth for the lock/merge/concurrency protocol assertions.
- Future changes to that protocol only need updating in one place instead of three.
