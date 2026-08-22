# Write the shell/native parity test

Add a parity spec (naming convention from `core/spec/bin/spawnIssueParity_spec.js`: `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js`) that runs both `auto-fix-all/scripts/cleanup_artifacts_shell.sh` and `core/bin/arcanum auto-fix-all-cleanup-artifacts` against the same fixture repo/args and asserts identical stdout and exit code, for at least the "nothing staged" and "something staged" cases.

Then manually verify `arcanum/_lib/engine_dispatch.sh` actually routes to each implementation as expected: run `auto-fix-all/scripts/cleanup_artifacts.sh` once with `engine.mode=shell` and once with `engine.mode=native` (after flipping `migration-status.json`, per `scripter.md`'s Step 2) against a scratch git repo, confirming both produce the same result.

## Files to Change

- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js` — new file
