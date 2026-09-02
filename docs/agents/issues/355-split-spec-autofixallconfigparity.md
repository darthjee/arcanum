# Issue: Split spec AutoFixAllConfigParity

## Description

`core/spec/bin/autoFixAllConfigParity_spec.js` is 279 lines — a shell-vs-native parity suite
covering all four `auto-fix-all-config-*` migrated entrypoints (`get`, `is-enabled`, `set`,
`toggle`) in one file, each its own top-level `describe` block, sharing a top-level
`beforeEach`/`afterEach` that builds/tears down a fresh fixture-repo pair, plus local helpers
(`runCommand`, `runPair`, `createFixtureRepo`, `seedConfig`).

## Problem

Four independent subcommands are bundled into one file. This is exactly the shape the repo
already has a convention for splitting (see `core/spec/bin/autoFixAllQueueParity/` — one file
per subcommand of the `auto-fix-all-queue-*` entrypoint family), but `auto-fix-all-config-*`
hasn't had it applied yet.

## Solution

Spec-only reorganization. No changes to `config_get_shell.sh`, `config_is_enabled_shell.sh`,
`config_set_shell.sh`, `config_toggle_shell.sh`, or the native
`auto-fix-all-config-*` implementations. No assertions change — every `it` moves verbatim.

### Split into 4 files, one per subcommand

New directory `core/spec/bin/autoFixAllConfigParity/`, matching `autoFixAllQueueParity/`'s
existing one-file-per-subcommand convention (the original monolith is deleted):

| New spec file | Covers (describe block) |
|---|---|
| `get_spec.js` | `get` |
| `is_enabled_spec.js` | `is-enabled` |
| `set_spec.js` | `set` |
| `toggle_spec.js` | `toggle` |

Each new file keeps its own `beforeEach`/`afterEach` fixture-repo setup (small, ~10 lines —
consistent with how `autoFixAllQueueParity/`'s own split files each carry their own
`beforeEach`/`afterEach` rather than sharing one across files).

### Extract shared helpers

Move `runCommand`, `runPair`, `createFixtureRepo`, and `seedConfig` into a shared support
module (e.g. `core/spec/support/factories/autoFixAllConfigParity.js`), imported by all four
new files. Behavior copied verbatim.

### Done when

- `autoFixAllConfigParity_spec.js` is gone; the four new files exist with every `it` from the
  original, unchanged, one file per subcommand.
- The shared-helper module exists and all four specs import from it (no copy-pasted helpers
  beyond the small per-file `beforeEach`/`afterEach`).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to the four `config_*_shell.sh` scripts or the native
  `auto-fix-all-config-*` implementations.

## Benefits

- Matches the existing `autoFixAllQueueParity/` one-subcommand-per-file convention exactly.
- Each subcommand's tests are independently readable/locatable.
- Pure navigability improvement — no behavior or coverage change, low review risk.
