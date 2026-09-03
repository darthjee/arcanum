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

**Assertion style: keep the inline `expect(...)` calls byte-for-byte.** Do not refactor the
repeated `expect(native.stdout).toEqual(shell.stdout)` / `expect(native.code).toEqual(shell.code)`
pair into the `expectParity()` helper from `../support/utils/runCommand.js`. The recent
split-spec issues (#350–#354) all keep these assertions inline; only the older
`autoFixAllQueueParity/` uses `expectParity()`. Keeping them verbatim makes the whole change
reviewable as a pure move.

### Split into 4 files, one per subcommand

**Split axis: per-subcommand**, matching `autoFixAllQueueParity/`. The per-scenario shape
used by the recent split-spec issues (#350–#354 — `argument_validation_spec.js`,
`happy_path_spec.js`, etc.) applies to *single-entrypoint* specs that have no subcommand
axis to split on. `auto-fix-all-config-*` is a multi-subcommand family, so each subcommand
gets its own file, 1:1 with the `config_*_shell.sh` scripts — exactly as `auto-fix-all-queue-*`
was already split.

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

**`set_spec.js` still calls `get`.** The `set` block's "valid write" `it` does a round-trip
check — `runPair('set', …)` followed by `runPair('get', …)` to assert the persisted value
matches on both sides. That `it` moves into `set_spec.js` verbatim. This is why the shared
setup module exports the **full** `SHELL_SCRIPTS` / `NATIVE_COMMANDS` maps (all four keys),
not per-subcommand slices — `set_spec.js` imports `runPair` and calls it with `'get'`
directly. (`toggle`'s `it`s only assert on `toggle`'s own stdout, so no other file
cross-calls.)

### Extract shared helpers

Move `runCommand`, `runPair`, `createFixtureRepo`, and `seedConfig` into a shared support
module at `core/spec/support/factories/autoFixAllConfigParitySetup.js` (the `...ParitySetup.js`
suffix matches every recent parity-setup module in that folder —
`autoFixAllCheckoutFromMainParitySetup.js`, `arcanumUpdateRunUpdateParitySetup.js`, etc.),
imported by all four new files. Behavior copied verbatim.

Also move the `SHELL_SCRIPTS` and `NATIVE_COMMANDS` maps into the same module.

**Reuse boundary (keep this a pure move).** The only forced change is the `REPO_ROOT`
derivation: the monolith computes it as three levels up from `core/spec/bin/`, which no
longer holds from `core/spec/support/factories/`. Import `REPO_ROOT` from
`../utils/runCommand.js` (the single shared dependency every recent parity-setup module
already uses) and derive `SCRIPTS_DIR` / `NATIVE_BIN` from it locally, exactly as the
monolith does today. Do **not** additionally pull `runCommand`, `git`, or `expectParity`
from `../utils/runCommand.js` — keep the local `runCommand` copy — matching
`autoFixAllCheckoutFromMainParitySetup.js` (issue #352) and keeping review risk minimal.

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
