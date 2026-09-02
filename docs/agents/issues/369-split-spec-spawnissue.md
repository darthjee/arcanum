# Issue: Split spec SpawnIssue

## Description

`core/spec/lib/commands/shared/SpawnIssue_spec.js` is 268 lines. `SpawnIssue`
(`core/lib/commands/shared/SpawnIssue.js`, ~235 lines) exposes a single public method,
`#run`, so the entire file is one top-level `describe('#run', ...)` containing 5 nested
scenario describes: `retry exhaustion` (3 `it`s), `retry then success` (1 `it`),
`delegation to LabelApplicator/IssueLinker` (2 `it`s), `scratch-file cleanup failure`
(1 `it`), `argument validation` (3 `it`s).

## Problem

Since there's only one public method, a split has to go by scenario rather than by method.
Several of the nested describes (`retry then success`, `delegation ...`,
`scratch-file cleanup failure`) are individually too small (1-2 `it`s) to be standalone
files. All scenarios share one inline `stubDeps()` + `buildContext()` pair.

## Solution

Spec-only reorganization. `SpawnIssue.js` is **not** touched — no production code and no
assertions change.

### Split into 3 files

Split by grouping related scenarios, as flat sibling files in
`core/spec/lib/commands/shared/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `SpawnIssueRetry_spec.js` | `SpawnIssue#run (retry behavior)` | `retry exhaustion` (3 `it`s) and `retry then success` (1 `it`) — the create-retry loop |
| `SpawnIssuePostCreate_spec.js` | `SpawnIssue#run (post-create side effects)` | `delegation to LabelApplicator/IssueLinker` (2 `it`s) and `scratch-file cleanup failure` (1 `it`) — everything that happens after a successful create |
| `SpawnIssueArgumentValidation_spec.js` | `SpawnIssue#run (argument validation)` | the current `argument validation` block (3 `it`s) |

Approx sizes: ~110 / ~55 / ~40 lines. The original `SpawnIssue_spec.js` is deleted; every
`it` moves verbatim into one of the three files.

Rejected alternative: one file per nested describe (5 files) — leaves 3 files at 1-2 `it`s
each.

### Extract shared helpers

Move the inline `stubDeps(overrides)` and `buildContext(opts)` helpers, plus the
`REPO_REF`/`DOMAIN`/`CREATE_OUTPUT`/`USAGE` constants, into a new module,
**`core/spec/support/factories/spawnIssue.js`**, imported by all three specs. Behavior is
copied verbatim; each spec keeps its own `beforeEach`/`afterEach` for the per-test
`repoPath`/`bodyFile` (`createTempDir`/`removeTempDir`, `writeFile`).

### Done when

- `SpawnIssue_spec.js` is gone; the three new files exist with every `it` from the original,
  unchanged, distributed per the split axis above.
- The shared-helper module exists and all three specs import from it (no copy-pasted
  helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/shared/SpawnIssue.js` is unchanged.

### Out of scope

- Any change to `SpawnIssue.js` or its collaborators (`LabelApplicator`, `IssueLinker`).
- The `bin/spawnIssueParity_spec.js` parity spec — separate file, not touched here.
- `LabelApplicator_spec.js` / `IssueLinker_spec.js` (separate, already-small files) — not
  touched here.

## Benefits

- Related scenarios (retry loop vs. post-create side effects vs. input validation) stay
  grouped instead of fragmenting into 1-2-`it` runt files.
- The shared stub/context builder lives in one reusable place.
- Pure navigability improvement — no behavior or coverage change, low review risk.
