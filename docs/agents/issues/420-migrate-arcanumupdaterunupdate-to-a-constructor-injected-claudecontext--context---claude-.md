# Issue: Migrate ArcanumUpdateRunUpdate to a constructor-injected ClaudeContext (context: 'claude')

## Description

`ArcanumUpdateRunUpdate` (`core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`)
backs the `arcanum-update-run-update-check` / `arcanum-update-run-update-apply` migrated
entrypoints. Its constructor takes only
`{ execFileAsync, spawnFn, readFile, existsSync }`; `check(repoPath)`, `apply(repoPath)`
and the helpers `_resolveTarget(repoPath)`, `_parseGithubOwnerRepo(repoPath)`,
`_currentVersion(repoPath, method)` all take `repoPath` — **the arcanum install's own
self-resolved location** — as a leading *method* argument. It is registered in
`core/lib/core/commands.js` with no `context` key (`context: 'none'`), so `Dispatcher`
does `new ArcanumUpdateRunUpdate()` and forwards the CLI args untouched. The install path
originates in `arcanum-update/scripts/run_update.sh` as
`TARGET_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"` (`BASH_SOURCE`).

Issue #324 ("Review: should ArcanumUpdateRunUpdate take a constructor-injected
RepoContext?", closed 2026-08-30) reviewed exactly this and concluded **stays exempt** —
because `RepoContext` models a *target repo* (`origin`, `githubToken`, `issueStateService`,
`configChain`, `githubIssue`, plus present/directory/git-repo validation), and binding one
to the arcanum install is a category mismatch.

**This issue supersedes that conclusion.** Companion issue #419 ("Extend ClaudeContext to
carry the runtime-validated arcanum install root") has now landed on `main` (via #421),
introducing the right abstraction: not `RepoContext`, but a `ClaudeContext` that anchors
on the install root and exposes `bootstrapPath()`, `arcanumJsonPath()`, `gitDirPath()`,
`installRoot()`, and `validateInstall()` (which throws the `STATUS=missing_arcanum`
contract and performs an anti-drift `realpath` identity check against the resolved
install root). With #419 merged, #324's objection no longer applies.

## Problem

The install path arrives as a positional method argument any caller supplies, rather than
a constructor-bound, validated context. Nothing structurally prevents `arcanum-update`
from acting on a sibling arcanum install belonging to a different `.claude` config on the
same machine (e.g. `~/.claude` vs `~/.claude-d`). It is also the last `context: 'none'`
command of this shape — every sibling command family has moved to a constructor-injected
context.

## Solution

Builds on #419, now merged (via #421). Mirrors the `context: 'claude'` precedent already
shipped for `permission-grant-add` / `PermissionGrant` in #321 (`Dispatcher` strips the
leading `<anchor>` argument, builds a `ClaudeContext` from it, and injects it as the
constructor's first positional).

- `core/lib/core/commands.js`: give `arcanum-update-run-update-check` /
  `arcanum-update-run-update-apply` `context: 'claude'`. Drop them from the exempt example
  in the top-of-file typedef comment (~lines 28–30, the `'none'` / absent case).
- `ArcanumUpdateRunUpdate`: constructor becomes
  `constructor(claudeContext, { execFileAsync, spawnFn, readFile, existsSync } = {})` —
  the `PermissionGrant` shape (`constructor(claudeContext, { lock } = {})`).
  - `check()` / `apply()` lose their `repoPath` parameter; so do `_resolveTarget()`,
    `_parseGithubOwnerRepo()`, `_currentVersion()`.
  - Resolve paths from the context: `this._claudeContext.bootstrapPath()`,
    `.arcanumJsonPath()`, `.gitDirPath()`, `.installRoot()`.
  - Keep the `STATUS=missing_arcanum\n` (exit 1) contract — either delegate to
    `ClaudeContext#validateInstall()` or reuse the same existence checks locally.
  - The `TARGET=<path>` line emitted by `check()` becomes `installRoot()`.
  - `_parseGithubOwnerRepo` still runs `git -C <installRoot> remote get-url origin`,
    unchanged except for where the path comes from.
- `core/lib/core/dispatcher.js`: `arcanum-update-run-update-*` is now context-bound, so
  `isContextBound()` is true → the leading `args[0]` (`TARGET_PATH`) is consumed by the
  `ClaudeContext` and stripped from the method args; `commandInstance()` already does
  `new ModuleClass(this.claudeContext)` for `context: 'claude'`. Expect no dispatcher code
  change beyond the enum entry.
- `arcanum-update/scripts/run_update.sh`: `check` already passes `-- "$TARGET_PATH"` as its
  sole positional; `apply` passes `HOME -- "$TARGET_PATH"` (the `HOME` token is the shell
  implementation's env passthrough). Confirm `arcanum/_lib/engine_dispatch.sh`'s native
  branch maps `$TARGET_PATH` → `args[0]` (the anchor the `ClaudeContext` needs) while
  preserving the `HOME` env token for the shell branch; adjust only if the current ordering
  does not already yield that.
- Shell parity: `run_update_check_shell.sh` / `run_update_apply_shell.sh` keep taking
  `TARGET_PATH` as `$1` — the shell engine mode is unchanged; only the native path gains
  the context.
- Specs:
  - `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js` and
    `ArcanumUpdateRunUpdateApply_spec.js` construct with a `ClaudeContext` (or a stub
    exposing `installRoot()` / `bootstrapPath()` / `arcanumJsonPath()` / `gitDirPath()`)
    instead of passing `repoPath` per call.
  - Update `core/spec/lib/core/dispatcherContextGetters_spec.js`,
    `dispatcherContextRouting_spec.js`, and `core/spec/lib/core/commands_spec.js` for the
    new `context: 'claude'` entry.
  - `core/spec/bin/arcanumUpdateRunUpdateParity` (and its factories
    `arcanumUpdateRunUpdateParitySetup.js` / `arcanumUpdateRunUpdate.js`) must still assert
    byte-identical shell/native output after the constructor change.

### Done when

- `arcanum-update-run-update-check` / `-apply` run with `context: 'claude'`;
  `ArcanumUpdateRunUpdate` takes `claudeContext` at construction and no method takes
  `repoPath`.
- `STATUS=missing_arcanum` (exit 1) behaviour and the `check` / `apply` stdout contracts
  (`METHOD=`/`REPO=`/`CURRENT=`/`TARGET=` and `RESULT=updated…` / `RESULT=noop…`) are
  byte-identical.
- Shell engine mode (`run_update_*_shell.sh`) still works unchanged.
- `make core-test` passes; `make core-lint` is clean; the dispatch-parity suite passes.

### Out of scope

- Extending `ClaudeContext` itself — companion issue #419 (already merged).
- Migrating `AutoFixAllConfig` — its own review #322 concluded "no change"; a separate
  discussion if ever revisited.

## Benefits

- `arcanum-update` can no longer be pointed at a sibling arcanum install belonging to
  another `.claude` config — the "never drifts" guarantee a constructor-bound,
  validated context provides.
- Removes the last `context: 'none'` command of this shape; consistent constructor style
  across the command layer.
