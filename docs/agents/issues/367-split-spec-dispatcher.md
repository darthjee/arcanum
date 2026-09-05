# Issue: Split spec dispatcher

## Description

`core/spec/lib/core/dispatcher_spec.js` is 276 lines, covering `Dispatcher`
(`core/lib/core/dispatcher.js`, ~135 lines) across 8 top-level `describe` blocks: the three
`context:` routing paths (`'none'`, `'repo'`, `'claude'`), the `repoContext`/`claudeContext`
lazy-getter pairs, `InvocationLog` recording, the unknown-command error, and `context: 'repo'`
`repoPath` validation (the largest single block, 6 `it`s).

## Problem

The file mixes several distinct concerns of the same class — routing, lazy context
construction, logging, and error/validation handling — with no grouping beyond flat
describes, making it hard to jump to the concern under review. Several individual describes
(the getter pairs, the unknown-command block) are too small to be standalone files.

## Solution

Spec-only reorganization. `dispatcher.js` is **not** touched — no production code and no
assertions change.

### Split into 4 files

Split by concern, as flat sibling files in `core/spec/lib/core/`:

| New spec file | Top-level `describe`(s) | Covers |
|---|---|---|
| `dispatcherContextRouting_spec.js` | `context: 'none' path`, `context: 'repo' path`, `context: 'claude' path` | how `commandInstance()`/`commandArgs()` route per entry `context` (8 `it`s) |
| `dispatcherContextGetters_spec.js` | `repoContext getter`, `claudeContext getter` | the lazy/memoized getter pairs (4 `it`s) |
| `dispatcherInvocationLog_spec.js` | `InvocationLog recording` | `record()` ordering/crash-survival proof, including its explanatory comment about `#342`'s dispatch-fixture-crash decoupling (2 `it`s) |
| `dispatcherErrorHandling_spec.js` | `unknown command`, `context: 'repo' repoPath validation` | the unknown-command rejection and all `repoPath` validation paths (7 `it`s total) |

Approx sizes: ~85 / ~30 / ~35 / ~90 lines. The original `dispatcher_spec.js` is deleted;
every `it` moves verbatim into one of the four files, along with the shared
`noopInvocationLog` constant and `fakeInvocationLog(events)` helper (both small, module-level,
already at the top of the file — copy as needed rather than extracting a shared support
module for two small locals).

Rejected alternative: one file per top-level describe (8 files) — leaves the two getter
blocks and the unknown-command block as 10-15-line runts.

### Done when

- `dispatcher_spec.js` is gone; the four new files exist with every `it` from the original,
  unchanged, distributed per the split axis above.
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/core/dispatcher.js` is unchanged.

### Out of scope

- Any change to `dispatcher.js`, `commands.js`, `RepoContext`, `ClaudeContext`, or
  `InvocationLog`.
- `commands_spec.js` / `InvocationLog_spec.js` (separate, already-small files) — not touched
  here.
- `core/spec/bin/arcanum_spec.js`'s own process-level crash-survival proof — unrelated file,
  not touched here.

## Benefits

- Each file covers one coherent concern of the dispatcher's behavior.
- Pure navigability improvement — no behavior or coverage change, low review risk.
