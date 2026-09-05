# Issue: Split spec ArcanumUpdateRunUpdate

## Description

`core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` is 270 lines, but only
has 2 top-level `describe` blocks (`#check`, 6 `it`s; `#apply`, 4 `it`s) — the bulk of the
file (~115 of 270 lines) is 6 shared local helpers (`fakeExistsSync`, `fakeReadFile`,
`fakeExecFileAsync`, `fakeSpawn`, `stubDeps`, `catchError`) that both blocks depend on.

## Problem

Because the split axis here is coarse (only 2 methods), a naive per-describe split would
require copying all ~115 lines of shared fakes into both new files, doubling boilerplate
instead of reducing it.

## Solution

Spec-only reorganization. `ArcanumUpdateRunUpdate.js` is **not** touched — no production code
and no assertions change.

### Split into 2 files

Split by method, as flat sibling files in `core/spec/lib/commands/arcanum-update/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `ArcanumUpdateRunUpdateCheck_spec.js` | `ArcanumUpdateRunUpdate#check` | the current `#check` block (6 `it`s) |
| `ArcanumUpdateRunUpdateApply_spec.js` | `ArcanumUpdateRunUpdate#apply` | the current `#apply` block (4 `it`s) |

Approx test-body sizes: ~85 / ~70 lines, plus each file's import of the shared helper module
below. The original `ArcanumUpdateRunUpdate_spec.js` is deleted; every `it` moves verbatim
into one of the two files.

### Extract shared helpers

Move all 6 inline helpers into one new module,
**`core/spec/support/factories/arcanumUpdateRunUpdate.js`**, imported by both specs:

- `fakeExistsSync(existingPaths)`, `fakeReadFile(sequence)`, `fakeExecFileAsync(handlers)`,
  `fakeSpawn(exitCode)`, `stubDeps(overrides)` — unchanged behavior.
- `catchError(fn)` — a generic async-error-capturing helper with no `ArcanumUpdateRunUpdate`-
  specific behavior; a repo-wide search found no existing equivalent under
  `core/spec/support/utils/`, so this is a new addition there rather than a duplicate.
- Also move the 4 path constants (`REPO_PATH`, `BOOTSTRAP_PATH`, `ARCANUM_JSON_PATH`,
  `GIT_DIR_PATH`) alongside the helpers, since `stubDeps`'s default `existsSync` already
  depends on `BOOTSTRAP_PATH`.

This is the split's real payoff: without it, both new files would duplicate the ~115-line
helper block; with it, each file is just its own `describe` plus a two-line import.

### Done when

- `ArcanumUpdateRunUpdate_spec.js` is gone; the two new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` is unchanged.

### Out of scope

- Any change to `ArcanumUpdateRunUpdate.js`.
- The `bin/arcanumUpdateRunUpdateParity_spec.js` parity spec — tracked separately (issue
  #353), not touched here.

## Benefits

- Each file covers one method's behavior without re-deriving ~115 lines of shared fakes.
- The shared fakes live in one reusable place instead of being copy-pasted across the split.
- Pure navigability improvement — no behavior or coverage change, low review risk.
