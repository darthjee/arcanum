# Parity test vs the shell implementation

Add `core/spec/bin/issueStateParity_spec.js`, following `checkoutSafeBranchParity_spec.js`/`resolvePlanPathsParity_spec.js`'s shape: run `arcanum/_lib/issue_state_shell.sh` (invoked directly — never through the `issue_state.sh` engine_dispatch shim, to avoid circularity) and `core/bin/arcanum issue-state` against identical temp-repo state, asserting identical stdout, exit code, and resulting state-file content, across:

- `get` on a missing state file, a missing field, and an existing field.
- `set` creating a new field and overwriting an existing one.
- `set-json` with an object value and an array value.
- `append-json` on a field that doesn't exist yet and one that's already an array.
- Missing required args (usage message to stderr, exit 1) and an unknown subcommand (`Unknown command: <command>`, exit 1) — assert these with `toContain` on the substantive text rather than exact equality, since the shell side's `$0`-based usage message isn't reproducible byte-for-byte by the native side (precedent: `permissionGrantParity_spec.js`).

Reuse `createGitFixtureRepo`/`createTempDir`/`removeTempDir` from `core/spec/support/utils/` as the other parity specs do.

## Files to Change

- `core/spec/bin/issueStateParity_spec.js` — new file.
