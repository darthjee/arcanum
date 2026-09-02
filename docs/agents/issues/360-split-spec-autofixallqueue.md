# Issue: Split spec AutoFixAllQueue

## Description

`core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` is 385 lines — the second
largest spec in the `auto-fix-all/` folder (largest is `GithubIssue_spec.js` at 387, outside
this folder). One file covers all 7 public methods of `AutoFixAllQueue` (`save`, `next`,
`waitNext`, `push`, `pop`, `empty`, `list`) plus a cross-cutting "lock contention" block, on
top of ~40 lines of shared local test helpers (`writeQueueFile`, `readQueueFile`, `newQueue`).

The class under test (`core/lib/commands/auto-fix-all/AutoFixAllQueue.js`, ~264 lines) already
delegates its file I/O to `QueueStore` and its label mutation to `IssueTagger` (see plans #253
and #323) — this issue is spec-only reorganization, mirroring #347's split of the sibling
`AutoFixAllGithub_spec.js`.

## Problem

The single large spec mixes read-only methods (`next`/`waitNext`/`list`), the lock-guarded
mutations (`push`/`pop`), the label-mutating `save`, and concurrency behavior, making it hard
to find the tests for one method. Its three shared local helpers are only usable inside this
one file, so any split would otherwise duplicate them.

The sibling shell-parity suite for this exact class already solves this problem one directory
level over: `core/spec/bin/autoFixAllQueueParity/` holds one file per subcommand
(`push_spec.js`, `save_spec.js`, `next_spec.js`, `pop_spec.js`, `empty_spec.js`, `list_spec.js`,
`wait_next_spec.js`) — but the `lib/` class spec that exercises the same methods directly has
never been split.

## Solution

Spec-only reorganization. `AutoFixAllQueue.js` and its delegates (`QueueStore`, `IssueTagger`,
`Lock`) are **not** touched — no production code and no assertions change.

### Split into 4 files

Split as flat sibling files in `core/spec/lib/commands/auto-fix-all/` (a subdirectory doesn't
fit this folder's existing layout — see #347's rejected alternatives), grouping the three small
read-only methods together and pairing "lock contention" with `#push`/`#pop` (the methods it
exercises) to avoid runt files:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `AutoFixAllQueueSave_spec.js` | `AutoFixAllQueue (save)` | `#save` |
| `AutoFixAllQueueReads_spec.js` | `AutoFixAllQueue (reads)` | `#next`, `#waitNext`, `#list` |
| `AutoFixAllQueuePush_spec.js` | `AutoFixAllQueue (push)` | `#push`, `lock contention` |
| `AutoFixAllQueuePop_spec.js` | `AutoFixAllQueue (pop & empty)` | `#pop`, `#empty` |

Approx test-body sizes: ~75 / ~75 / ~100 / ~65 lines. The original `AutoFixAllQueue_spec.js`
is deleted; every `it` moves verbatim into one of the four files.

Rejected alternatives:
- One file per method (7 files) — leaves `#next`/`#waitNext`/`#list`/`#pop`/`#empty` each as
  runt files under 30 lines.
- Per-class subdirectory `AutoFixAllQueue/` — no precedent under `core/spec/lib/`; the one
  existing split there (#347) uses flat sibling files.

### Extract shared helpers

Move the three inline helpers into a new module,
**`core/spec/support/factories/autoFixAllQueue.js`**, imported by all four specs:

- `createAutoFixAllQueue(dir, overrides)` — the current `newQueue` body, parameterized by
  `dir` instead of closing over an outer-scope variable.
- `writeQueueFile(queueFile, entries)` / `readQueueFile(queueFile)` — the current inline
  helpers, unchanged behavior, parameterized by the queue file path instead of closing over it.

Helper behavior is copied verbatim aside from the parameterization needed for reuse across
files. Each split file keeps its own `beforeEach`/`afterEach` (temp dir + `queueFile`/
`lockFile` derivation) and imports the shared factory.

No jasmine config change needed: support modules are imported directly by specs (`helpers: []`).

### Done when

- `AutoFixAllQueue_spec.js` is gone; the four new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and all four specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/auto-fix-all/AutoFixAllQueue.js` is unchanged.

### Out of scope

- Any change to `AutoFixAllQueue.js` or its delegates (`QueueStore`, `IssueTagger`, `Lock`).
- The `bin/autoFixAllQueueParity/` specs — already split, not touched here.
- No migration, no skill/script changes, no new top-level folder.

## Benefits

- Each file covers one coherent slice of the class's behavior (save/mutate/read), matching how
  the already-split shell-parity suite for the same class is organized.
- The shared helpers live in one reusable place instead of being copy-pasted across the split.
- Pure navigability improvement — no behavior or coverage change, low review risk.
