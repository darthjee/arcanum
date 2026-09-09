# node Plan: Extend ClaudeContext to carry the runtime-validated arcanum install root

Main plan: [plan.md](plan.md)

## Overview

`ClaudeContext` (`core/lib/context/ClaudeContext.js`, added in #321) today only anchors
Claude settings-file paths for `permission-grant-add`. This adds:

1. pure string-building accessors for the arcanum install root and its marker paths;
2. `configDir()`, with `globalSettingsPath()` re-expressed in terms of it (no behaviour
   change);
3. one lazy `fs` validator `validateInstall()` — mirrors `RepoContext#validate()` — with
   two independent assertions: the arcanum structural markers exist under the anchor
   (reusing the existing `DispatchFailure('STATUS=missing_arcanum\n', 1)` contract), and
   `realpath(installRoot()) === realpath(INSTALL_ROOT)`.

No consumer (`ArcanumUpdateRunUpdate`, dispatcher, `commands.js`) changes here — that is
issue #420.

## Context

- `core/lib/utils/file/InstallRoot.js` exports `INSTALL_ROOT` (`import.meta.url` +
  four `..`), added in #325. `core/lib/context/` importing `core/lib/utils/file/` is
  within the one-way `commands → context/services → utils` layering the ESLint guardrail
  in `core/eslint.config.mjs` enforces (the guardrail only forbids `context/`/`services/`/
  `utils/` importing from `commands/`).
- `RepoContext#validate()` (`core/lib/context/RepoContext.js`) is the precedent for a lazy,
  never-in-constructor `fs` validator on a context. Its spec
  (`core/spec/lib/context/RepoContext_spec.js` `describe('#validate')`) covers the delegate
  call and the rejection propagation.
- `ArcanumUpdateRunUpdate._resolveTarget`
  (`core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js:101-125`) is the existing
  structural check to centralize: `bootstrap.sh` exists **and** (`arcanum.json` exists
  **or** `.git` exists), else `throw new DispatchFailure('STATUS=missing_arcanum\n', 1)`.
- `ClaudeContext`'s constructor is `constructor({ repoPath, env = process.env } = {})`;
  its spec (`core/spec/lib/context/ClaudeContext_spec.js`) builds it with
  `{ repoPath: '/fake/repo', env: {} }` and asserts pure string outputs.
- `DispatchFailure` lives at `core/lib/utils/errors/DispatchFailure.js` — also within the
  allowed layering for a `context/` import.

## Implementation Steps

### Step 1 — Extend ClaudeContext with install-root accessors and validateInstall()

In `core/lib/context/ClaudeContext.js`:

- **Imports**: add `import { existsSync } from 'node:fs'` and
  `import { realpath } from 'node:fs/promises'` (async, matching `RepoContext#validate()`'s
  async shape), and `import { INSTALL_ROOT } from '../utils/file/InstallRoot.js'` and
  `import DispatchFailure from '../utils/errors/DispatchFailure.js'`.
- **Constructor**: extend the options object to
  `constructor({ repoPath, env = process.env, existsSync: existsSyncFn = existsSync,
  realpath: realpathFn = realpath, runtimeInstallRoot = INSTALL_ROOT } = {})`, storing the
  three new deps privately. `existsSyncFn` / `realpathFn` / `runtimeInstallRoot` are
  spec-injection points only — same rationale as the already-injectable `env` — and default
  to the real implementations / the module constant. Keep `this.repoPath = repoPath` and
  `this._env = env` exactly as now.
- **`configDir()`**: new method returning
  `this._env.CLAUDE_CONFIG_DIR || path.join(this._env.HOME, '.claude')`. Re-express
  `globalSettingsPath()` as `path.join(this.configDir(), 'settings.json')` — output
  unchanged.
- **Install-root accessors** (pure string building, no `fs`):
  - `installRoot()` → `this.repoPath` (the anchor is the install root; keep it a method for
    symmetry with the others and so a future normalization has one home).
  - `bootstrapPath()` → `path.join(this.installRoot(), 'arcanum', 'update', 'bootstrap.sh')`
  - `arcanumJsonPath()` → `path.join(this.installRoot(), 'arcanum.json')`
  - `gitDirPath()` → `path.join(this.installRoot(), '.git')`
- **`validateInstall()`** — `async`, lazy, never called from the constructor (document this
  the way `RepoContext#validate()`'s JSDoc does):
  1. **Structural marker check**: if
     `!this._existsSync(this.bootstrapPath())` **or**
     (`!this._existsSync(this.arcanumJsonPath())` **and**
     `!this._existsSync(this.gitDirPath())`), then
     `throw new DispatchFailure('STATUS=missing_arcanum\n', 1)` — byte-identical to
     `ArcanumUpdateRunUpdate._resolveTarget`.
  2. **Anti-drift identity check**: resolve both sides through the injected `realpath`
     (`const anchorReal = await this._realpath(this.installRoot());`
     `const runtimeReal = await this._realpath(this._runtimeInstallRoot);`) and, if they
     differ, `throw new Error('arcanum install at ' + this.installRoot() + ' is not the
     running arcanum install (' + this._runtimeInstallRoot + ')')`. A plain `Error` (not
     `DispatchFailure`) — this is a "should never happen / malformed install or #319-class
     regression" condition, and the `arcanum: <message>` stderr line is wanted here.
- **JSDoc**: update the class-level comment — it is no longer "every method is pure string
  building / no `fs`"; call out the single lazy `fs` validator exactly as `RepoContext`
  documents `validate()` ("never runs from the constructor, since specs build it with fake
  paths"). Add `@param` lines for the three new constructor deps and method JSDoc for every
  new method (the `jsdoc/require-jsdoc` rule is `error` for public methods).

### Step 2 — Spec coverage in ClaudeContext_spec.js

In `core/spec/lib/context/ClaudeContext_spec.js` (leave every existing `describe` block
untouched):

- Import `createTempDir` / `removeTempDir` from `../../support/utils/tempDir.js`; add an
  `afterEach` that removes any temp dir a test created.
- **`#configDir`**: `CLAUDE_CONFIG_DIR` wins when set; `$HOME/.claude` fallback otherwise
  (mirror the two existing `#globalSettingsPath` cases).
- **`#installRoot` / `#bootstrapPath` / `#arcanumJsonPath` / `#gitDirPath`**: with
  `repoPath: '/fake/repo'`, assert the four literal strings
  (`/fake/repo`, `/fake/repo/arcanum/update/bootstrap.sh`, `/fake/repo/arcanum.json`,
  `/fake/repo/.git`).
- **`#validateInstall`** — build a real temp dir as the install root:
  - *happy path*: `mkdir -p <tmp>/arcanum/update`, `writeFile <tmp>/arcanum/update/bootstrap.sh`,
    `writeFile <tmp>/arcanum.json`; construct with
    `{ repoPath: tmp, env: {}, runtimeInstallRoot: tmp }`; `await
    expectAsync(context.validateInstall()).toBeResolved()`.
  - *`.git`-only variant*: markers = `bootstrap.sh` + `mkdir <tmp>/.git` (no `arcanum.json`)
    — still resolves.
  - *missing-arcanum*: `bootstrap.sh` absent (or present but neither `arcanum.json` nor
    `.git`) → rejects with a `DispatchFailure` whose `.stdout === 'STATUS=missing_arcanum\n'`
    and `.exitCode === 1`.
  - *identity mismatch*: markers all present, but
    `runtimeInstallRoot: <a second temp dir>` → rejects with an `Error` whose message
    contains both paths.
  - *symlinked anchor*: create `<tmp2>` as a `symlink` to `<tmp>`, pass `repoPath: tmp2`,
    `runtimeInstallRoot: tmp` → resolves (proves both sides go through `realpath`).
- Keep using the plain `new ClaudeContext({...})` constructor (no factory needed); the
  injected `existsSync` default is fine for the temp-dir tests since the files really
  exist, so tests need only inject `runtimeInstallRoot`.

## Files to Change

- `core/lib/context/ClaudeContext.js` — new imports; constructor gains `existsSync` /
  `realpath` / `runtimeInstallRoot` injection points; new `configDir()`, `installRoot()`,
  `bootstrapPath()`, `arcanumJsonPath()`, `gitDirPath()`, `validateInstall()`;
  `globalSettingsPath()` re-expressed via `configDir()`; class JSDoc updated.
- `core/spec/lib/context/ClaudeContext_spec.js` — add `#configDir`, install-path accessor,
  and `#validateInstall` describe blocks (happy / `.git`-only / missing-arcanum / identity
  mismatch / symlinked anchor); `afterEach` temp-dir cleanup. Existing blocks unchanged.

## CI Checks

- `core/`: `make core-lint` (CircleCI job: `checks` → `yarn lint`) — must stay clean,
  including the `no-restricted-imports` layering guardrail and `jsdoc/require-jsdoc`.
- `core/`: `make core-test` (CircleCI job: `test` → `yarn test`, Jasmine + c8 coverage).

## Notes

- The anchor threading (`context: 'claude'` leading arg, kept per the issue) is redundant
  for correctness once `validateInstall()` requires `anchor === INSTALL_ROOT` — it exists
  to reuse the `permission-grant-add` pattern and to make `validateInstall()` a genuine
  cross-check of the shell (`BASH_SOURCE`) vs Node (`import.meta.url`) resolutions.
- Async `validateInstall()` matches `RepoContext#validate()`; #420 will `await` it on the
  `context: 'claude'` dispatch path the way the dispatcher `await`s `repoContext.validate()`
  for `context: 'repo'`.
- No shell-side change: `arcanum-update/scripts/run_update_common.sh`'s `resolve_target`
  keeps its own checks; a shell mirror of the identity check is explicitly out of scope.
- `arcanum.json` is absent in a git-clone/worktree install (it is zip-install-only), which
  is why the structural check is `bootstrap.sh AND (arcanum.json OR .git)` — unchanged from
  today's behaviour.
