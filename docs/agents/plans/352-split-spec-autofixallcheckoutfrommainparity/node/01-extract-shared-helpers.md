# Extract shared git-fixture helpers into a support factory

Lift the seven local helpers currently defined at the top of
`core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` (lines ~44–169, before the top-level
`describe`) into a new support factory module, so `happy_path_spec.js` and
`merge_conflict_spec.js` (step 02) can both import them without duplication. Follow the
`autoFixAllWaitCiParitySetup.js` precedent: a plain module of named exports, no class, importing
shared low-level utilities (`createGitFixtureRepo`, `createTempDir`, etc.) from
`core/spec/support/utils/` rather than redefining them.

Move verbatim, unchanged:
- `git(args, cwd)`
- `runCommand([file, ...args], cwd)`
- `buildRepoPair(seedFn, id)`
- `runPair(id, shellRepo, nativeRepo)`
- `seedExistingLocalBranch(repo, id)`
- `seedRemoteOnlyBranch(repo, id)`
- `seedConflictingBranch(repo, id)`

Also move the module-level constants `SHELL_SCRIPT` and `NATIVE_BIN` (and their `REPO_ROOT`
derivation) — `runPair` and the argument-validation describes (step 03) both reference them, so
all three new spec files end up importing `SHELL_SCRIPT`/`NATIVE_BIN` from this one factory.

`runCommand` here is a same-named but distinct helper from `core/spec/support/utils/runCommand.js`'s
exported `runCommand` (used elsewhere in the repo's already-split parity specs) — keep it a
local export of this new factory module, not merged with the existing one, since its signature
(`[file, ...args]` tuple) differs. `argument_validation_spec.js` (step 03) also needs this
`runCommand`, not just `happy_path_spec.js`/`merge_conflict_spec.js`, since the original file's
argument-validation describes call it directly (e.g. `runCommand([SHELL_SCRIPT, '', ''], cwd)`).

## Files to Change

- `core/spec/support/factories/autoFixAllCheckoutFromMainParitySetup.js` — new file; the seven
  helpers plus `SHELL_SCRIPT`/`NATIVE_BIN`/`REPO_ROOT`, each exported by name.
