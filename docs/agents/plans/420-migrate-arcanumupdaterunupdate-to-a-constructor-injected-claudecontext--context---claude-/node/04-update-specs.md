# Update specs

Bring the unit specs, registry/dispatcher specs, and parity harness in line with the new
constructor shape — the parity specs' fixtures and assertions should need no changes to
their expectations (only, if anything, to how the native side is invoked), since the
`METHOD=`/`REPO=`/`CURRENT=`/`TARGET=`/`RESULT=`/`STATUS=missing_arcanum` contracts stay
byte-identical per the issue's "Done when".

## Files to Change

- `core/spec/support/factories/arcanumUpdateRunUpdate.js`: add a way to build a
  `ClaudeContext` (or a minimal stub exposing `installRoot()` / `bootstrapPath()` /
  `arcanumJsonPath()` / `gitDirPath()`) anchored at the existing `REPO_PATH` constant —
  mirroring how `PermissionGrant_spec.js` builds `new ClaudeContext({ repoPath: dir })` —
  so both spec files below can construct `ArcanumUpdateRunUpdate` the same way.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js`: construct
  `new ArcanumUpdateRunUpdate(claudeContext, stubDeps({...}))` and call `runUpdate.check()`
  with no argument, instead of `new ArcanumUpdateRunUpdate(stubDeps({...}))` +
  `runUpdate.check(REPO_PATH)`. Expected output strings (e.g.
  `TARGET=${REPO_PATH}`) are unchanged since `REPO_PATH` still backs `installRoot()`.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`: same
  constructor/call-site change as the check spec, for `runUpdate.apply()`.
- `core/spec/lib/core/commands_spec.js`: add assertions mirroring the existing
  `it('sets context: \'claude\' on permission-grant-add', ...)` block (around line 47) for
  both `COMMANDS['arcanum-update-run-update-check'].context` and
  `COMMANDS['arcanum-update-run-update-apply'].context`, each expected to equal `'claude'`.
- `core/spec/lib/core/dispatcherContextRouting_spec.js`: consider adding a
  `describe('context: \'claude\' path (arcanum-update-run-update-*)', ...)` block mirroring
  the existing `permission-grant-add` one (around line 68) — constructing a `Dispatcher`
  for one of the two commands and asserting `instance._claudeContext` is a `ClaudeContext`
  built from the leading argument. Optional if the existing generic `'claude'`-path
  coverage already exercises this branch adequately; use judgment once the registry entry
  from step 01 is in place.
- `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` and `apply_spec.js`: no
  expectation changes anticipated (fixtures and assertions are all CLI-level, unaware of
  the constructor shape) — run them after steps 01–02 land and confirm they still pass
  byte-identically; only touch them if native behavior actually diverges.
