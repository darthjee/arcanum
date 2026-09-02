# Issue: Split spec IssueStateService

## Description

`core/spec/lib/services/IssueStateService_spec.js` is 281 lines, covering all 5 public
methods of `IssueStateService` (`core/lib/services/IssueStateService.js`, ~200 lines):
`#write`, `#get`, `#set`, `#setJson`, `#appendJson`, plus repeated lock-acquire/release and
concurrent-write-safety assertions across several of them.

## Problem

`#set`/`#setJson`/`#appendJson` are all thin variants layered on top of `#write`/`_mutate`
(the file's own doc comments say so explicitly), so a strict one-file-per-method split
would scatter closely-related mutation tests across too many files. `#get` alone is only 3
`it`s (~22 lines) — too small to be its own file.

## Solution

Spec-only reorganization. `IssueStateService.js` is **not** touched — no production code and
no assertions change.

### Split into 3 files

Split by conceptual grouping rather than strictly one-per-method, as flat sibling files in
`core/spec/lib/services/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `IssueStateServiceWrite_spec.js` | `IssueStateService (write & read)` | `#write` (5 `it`s) and `#get` (3 `it`s) — the file's core read/write pair |
| `IssueStateServiceSet_spec.js` | `IssueStateService (field setters)` | `#set` (4 `it`s) and `#setJson` (4 `it`s) — single-field setter variants |
| `IssueStateServiceAppendJson_spec.js` | `IssueStateService#appendJson` | the current `#appendJson` block (5 `it`s) |

Approx sizes: ~100 / ~100 / ~55 lines. The original `IssueStateService_spec.js` is deleted;
every `it` moves verbatim into one of the three files, keeping each file's own
`beforeEach`/`afterEach` (`repoPath`/`context`/`stateFile` via `createTempDir`/
`removeTempDir`) — trivial, already-shared-utility-backed setup, not worth extracting further.

Rejected alternative: one file per method (5 files) — leaves `#get` as a ~25-line runt and
splits `#set`/`#setJson`, which the source itself treats as near-identical variants, across
two files.

### Done when

- `IssueStateService_spec.js` is gone; the three new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/services/IssueStateService.js` is unchanged.

### Out of scope

- Any change to `IssueStateService.js` or its collaborators (`Lock`, `JsonParser`,
  `JsonReader`, `JsonValueFormatter`, `IssueStatePaths`).
- `Lock_spec.js` / `IssueStatePaths_spec.js` / `JsonParser_spec.js` (separate, already-small
  files) — not touched here.

## Benefits

- Each file groups behaviorally-related methods instead of leaving a lone runt file.
- Pure navigability improvement — no behavior or coverage change, low review risk.
