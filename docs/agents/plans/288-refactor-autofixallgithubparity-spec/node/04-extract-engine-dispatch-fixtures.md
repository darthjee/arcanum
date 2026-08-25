# Extract engine_dispatch fixtures

Create `core/spec/support/fixtures/engineDispatchFixtures.js` and move `buildDispatchFixtures` (currently `core/spec/bin/autoFixAllGithubParity_spec.js` lines 536–557, inside the `engine_dispatch routing` describe block) into it, exported, with its JSDoc comment adapted from the original.

Also move the `ENGINE_DISPATCH_SCRIPT` constant (defined near the top of the current spec file, alongside `SHELL_SCRIPT`/`NATIVE_BIN`) into this same module, computing `REPO_ROOT` relative to *this file's own location* (same reasoning as step 01's `runCommand.js`), and export it too.

`seedEngineMode` (lines 559–570) is small, local to the two routing tests, and used nowhere else — leave it inline in `engine_dispatch_spec.js` (written in step 05) rather than extracting it.

## Files to Change

- `core/spec/support/fixtures/engineDispatchFixtures.js` — new file: `buildDispatchFixtures`, `ENGINE_DISPATCH_SCRIPT`, both exported.
