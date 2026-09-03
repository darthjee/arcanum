# node Plan: Split spec AutoFixAllConfigParity

Main plan: [plan.md](plan.md)

## Overview

Break the 279-line `core/spec/bin/autoFixAllConfigParity_spec.js` monolith into:

- one shared setup module at `core/spec/support/factories/autoFixAllConfigParitySetup.js`
  holding the helpers and the `SHELL_SCRIPTS` / `NATIVE_COMMANDS` maps, and
- four per-subcommand spec files under a new `core/spec/bin/autoFixAllConfigParity/`
  directory (`get_spec.js`, `is_enabled_spec.js`, `set_spec.js`, `toggle_spec.js`),

then delete the monolith. Pure move — every `it` body is copied byte-for-byte, assertions
included; no `config_*_shell.sh` script or native `auto-fix-all-config-*` module is touched.

## Context

`core/spec/bin/autoFixAllConfigParity_spec.js` today has:

- A ~23-line top-of-file comment block explaining the shell-vs-native parity approach.
- Local helpers: `execFileAsync` (`promisify(execFile)`), `runCommand([file, ...args], cwd)`,
  `runPair(subcommand, shellRepo, nativeRepo, rest)`, `createFixtureRepo(prefix)` (git-inits
  the temp dir), `seedConfig(repoPath, { newConfig, legacyConfig, stateConfig })`.
- Module constants: `REPO_ROOT` (derived as three `..` up from `core/spec/bin/`),
  `SCRIPTS_DIR`, `NATIVE_BIN`, and the `SHELL_SCRIPTS` / `NATIVE_COMMANDS` maps (both keyed
  `get` / `is-enabled` / `set` / `toggle`).
- One top-level `describe('auto-fix-all-config-* parity (shell vs. native)', …)` with a
  shared `beforeEach`/`afterEach` that builds/removes `shellRepo` + `nativeRepo`, wrapping
  four nested `describe` blocks: `get` (4 `it`s), `is-enabled` (2), `set` (3), `toggle` (2) —
  11 `it`s total.
- `set`'s "valid write" `it` does a round-trip: `runPair('set', …)` then `runPair('get', …)`.
- `toggle`'s `it`s assert only on `toggle`'s own stdout — no cross-subcommand call.

Reference precedent — `core/spec/bin/autoFixAllQueueParity/` (the `auto-fix-all-queue-*`
family, already split one-file-per-subcommand: `pop_spec.js`, `push_spec.js`,
`wait_next_spec.js`, …) with its shared `core/spec/support/factories/queueParitySetup.js`.
Each queue split file carries its own header comment, its own per-file fixture setup, and
imports helpers from the setup module + `removeTempDir` from `../../support/utils/tempDir.js`.

`core/spec/support/jasmine.json`'s `spec_files` glob is `bin/**/*_spec.js`, so files under
the new nested `bin/autoFixAllConfigParity/` directory are picked up automatically — no
jasmine config change.

All conventions below were settled during issue refinement (see the issue's "Assertion
style", "Split axis", "`set_spec.js` still calls `get`", and "Reuse boundary" sections) —
do not re-litigate them:

- **Split axis:** per-subcommand, 1:1 with the `config_*_shell.sh` scripts.
- **Setup module name:** `autoFixAllConfigParitySetup.js` (the `...ParitySetup.js` suffix,
  matching every recent module in `core/spec/support/factories/`).
- **Reuse boundary:** import only `REPO_ROOT` from `../utils/runCommand.js`; keep the local
  `runCommand` copy; do **not** pull `runCommand` / `git` / `expectParity` from there.
- **Assertion style:** keep the inline `expect(native.stdout).toEqual(shell.stdout)` /
  `expect(native.code).toEqual(shell.code)` pairs byte-for-byte; do **not** switch to
  `expectParity()`.
- **File names:** snake_case (`is_enabled_spec.js`, not `is-enabled_spec.js`) — matches
  `autoFixAllQueueParity/wait_next_spec.js`.

## Implementation Steps

### Step 1 — Create the shared setup module

Create `core/spec/support/factories/autoFixAllConfigParitySetup.js` by moving the monolith's
helpers and maps verbatim, with only the path-derivation change forced by the new location:

- `import { REPO_ROOT } from '../utils/runCommand.js';` instead of the local
  `fileURLToPath(import.meta.url)` + three-`..` `REPO_ROOT` computation. (`../utils/runCommand.js`
  already exports `REPO_ROOT` derived four `..` up from `core/spec/support/utils/`, which is
  the repo root — the correct value from the factories directory too.)
- Keep `import { execFile } from 'node:child_process';`,
  `import { mkdir, writeFile } from 'node:fs/promises';`, `import path from 'node:path';`,
  `import { promisify } from 'node:util';`, and
  `import { createTempDir } from '../utils/tempDir.js';` (path adjusted from the monolith's
  `../support/utils/tempDir.js` — `createFixtureRepo` needs `createTempDir`).
- `const execFileAsync = promisify(execFile);` — unchanged.
- Derive `SCRIPTS_DIR = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');` and
  `NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');` locally, exactly as the
  monolith does.
- `export const SHELL_SCRIPTS = { get, 'is-enabled', set, toggle }` and
  `export const NATIVE_COMMANDS = { … }` — moved verbatim, now `export`ed.
- `export async function runCommand([file, ...args], cwd) { … }` — body byte-identical to the
  monolith's (the try/execFileAsync/catch shape returning `{ stdout, stderr, code }`).
- `export async function runPair(subcommand, shellRepo, nativeRepo, rest) { … }` — verbatim;
  it references `SHELL_SCRIPTS`, `NATIVE_COMMANDS`, `NATIVE_BIN`, `process.execPath`,
  `runCommand`.
- `export async function createFixtureRepo(prefix) { … }` — verbatim (`createTempDir` +
  `git init --quiet -b main`).
- `export async function seedConfig(repoPath, { newConfig, legacyConfig, stateConfig } = {}) { … }`
  — verbatim (writes `.claude/configuration/arcanum-repo-config.json`,
  `.claude/configuration/auto-fix-all.json`, `.claude/state/arcanum-config.json`).
- Carry the relevant portion of the monolith's top-of-file comment across as a short module
  doc comment describing what the module provides (the fixture-repo pair + the shell/native
  runners). Keep JSDoc on every exported function (copy from the monolith).

### Step 2 — Create the four per-subcommand spec files and delete the monolith

Create `core/spec/bin/autoFixAllConfigParity/` with one file per subcommand. Each file:

- **Imports:**
  `import { runPair, seedConfig, createFixtureRepo } from '../../support/factories/autoFixAllConfigParitySetup.js';`
  and `import { removeTempDir } from '../../support/utils/tempDir.js';`.
  (`get_spec.js` / `is_enabled_spec.js` / `toggle_spec.js` do not need `seedConfig` in every
  case — import only what the file's `it`s actually use, matching per-file import hygiene in
  `autoFixAllQueueParity/`. `set_spec.js` needs `runPair` only — it calls both `'set'` and
  `'get'` through it.)
- **Header comment:** adapt the monolith's top-of-file block into a per-file version naming
  the one subcommand under test (mirror how each `autoFixAllQueueParity/*_spec.js` narrows
  the shared comment to its subcommand).
- **`describe`:** a single top-level
  `describe('auto-fix-all-config-* parity (shell vs. native) — <subcommand>', () => { … })`
  (flatten the monolith's outer + nested `describe` into one, subcommand named in the
  string — same style as `autoFixAllQueueParity/`'s `— pop` / `— list` suffixes).
- **Fixture setup:** its own `let shellRepo, nativeRepo;` + `beforeEach` calling
  `createFixtureRepo('arcanum-core-afac-parity-shell-')` /
  `createFixtureRepo('arcanum-core-afac-parity-native-')` + `afterEach` calling
  `removeTempDir` on both — copied from the monolith's shared `beforeEach`/`afterEach`,
  kept per-file (consistent with `autoFixAllQueueParity/`).
- **`it`s:** every `it` from the corresponding monolith `describe` block, moved **verbatim** —
  bodies unchanged, including the inline `expect(native.stdout).toEqual(shell.stdout)` /
  `expect(native.code).toEqual(shell.code)` / `expect(shell.code)` / `expect(shell.stdout)`
  assertions. Do not introduce `expectParity()`.

File → source `describe` block:

| New file | Monolith `describe` | `it` count |
|---|---|---|
| `get_spec.js` | `get` | 4 |
| `is_enabled_spec.js` | `is-enabled` | 2 |
| `set_spec.js` | `set` | 3 |
| `toggle_spec.js` | `toggle` | 2 |

`set_spec.js`'s "valid write" `it` keeps its `runPair('set', …)` → `runPair('get', …)`
round-trip unchanged — the full `SHELL_SCRIPTS` / `NATIVE_COMMANDS` maps from the setup
module make `runPair('get', …)` work there without any extra import.

Then delete `core/spec/bin/autoFixAllConfigParity_spec.js`.

## Files to Change

- `core/spec/support/factories/autoFixAllConfigParitySetup.js` — **new.** Shared helpers
  (`runCommand`, `runPair`, `createFixtureRepo`, `seedConfig`) and the `SHELL_SCRIPTS` /
  `NATIVE_COMMANDS` maps, moved verbatim from the monolith; `REPO_ROOT` imported from
  `../utils/runCommand.js` instead of computed locally.
- `core/spec/bin/autoFixAllConfigParity/get_spec.js` — **new.** The `get` block's 4 `it`s +
  own header/fixture setup.
- `core/spec/bin/autoFixAllConfigParity/is_enabled_spec.js` — **new.** The `is-enabled`
  block's 2 `it`s + own header/fixture setup.
- `core/spec/bin/autoFixAllConfigParity/set_spec.js` — **new.** The `set` block's 3 `it`s
  (including the `get` round-trip `it`) + own header/fixture setup.
- `core/spec/bin/autoFixAllConfigParity/toggle_spec.js` — **new.** The `toggle` block's 2
  `it`s + own header/fixture setup.
- `core/spec/bin/autoFixAllConfigParity_spec.js` — **deleted.**

## CI Checks

- `core`: `make core-test` (CI job: `test` — `yarn test` in `core/`)
- `core`: `make core-lint` (CI job: `checks` — `yarn lint` in `core/`)

Expected: identical total spec count before and after (11 `auto-fix-all-config-*` parity
`it`s), lint clean.

## Notes

- No `core/spec/support/jasmine.json` change — the `bin/**/*_spec.js` glob already covers the
  new nested directory.
- No production code touched: `auto-fix-all/scripts/config_{get,is_enabled,set,toggle}_shell.sh`
  and the native `auto-fix-all-config-*` implementations are out of scope.
- Watch the relative-path depth when moving helpers: specs go one level deeper
  (`bin/autoFixAllConfigParity/` → `../../support/...`), and the setup module sits at
  `support/factories/` → `../utils/...`. The monolith's `../support/utils/tempDir.js`
  becomes `../utils/tempDir.js` in the setup module and `../../support/utils/tempDir.js` in
  each spec.
- Keep `random: true` (jasmine.json) in mind: the four files must be order-independent, which
  they already are — each builds and tears down its own fixture pair per `it`.
