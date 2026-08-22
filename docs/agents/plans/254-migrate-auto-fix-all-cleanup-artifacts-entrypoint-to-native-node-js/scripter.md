# scripter Plan: Migrate auto-fix-all-cleanup-artifacts entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command name `auto-fix-all-cleanup-artifacts` must match the `core/bin/arcanum` `COMMANDS` key node registers.
- The shim must forward `HOME` in its `engine_dispatch` call (git identity resolution) — no other env vars.
- Flip the `migration-status.json` flag only once node's implementation and registration are in place — until then this entrypoint keeps running the shell path even under `engine.mode=native`.

## Implementation Steps

### Step 1 — Split `cleanup_artifacts.sh` into a shell implementation + thin engine_dispatch shim

Move the current logic of `auto-fix-all/scripts/cleanup_artifacts.sh` verbatim into a new `auto-fix-all/scripts/cleanup_artifacts_shell.sh` (same shebang, same body, same `Usage: $0 <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>` string). Replace `cleanup_artifacts.sh` itself with a thin shim mirroring `arcanum/_lib/spawn_issue.sh`'s shape: parse/validate the same required args, source `engine_dispatch.sh`, and call

```bash
engine_dispatch "$REPO_PATH" auto-fix-all-cleanup-artifacts "${SCRIPT_DIR}/cleanup_artifacts_shell.sh" HOME -- "$@"
```

### Step 2 — Flip the migration-status flag

Set `"auto-fix-all-cleanup-artifacts": true` in `arcanum/_lib/migration-status.json` — this is the switch that makes `engine.mode=native` actually take effect for this entrypoint, so it should land only after node's `AutoFixAllCleanupArtifacts.js` and its `COMMANDS` registration exist.

## Files to Change

- `auto-fix-all/scripts/cleanup_artifacts.sh` — replace with a thin engine_dispatch shim
- `auto-fix-all/scripts/cleanup_artifacts_shell.sh` — new file, original logic moved verbatim
- `arcanum/_lib/migration-status.json` — flip `auto-fix-all-cleanup-artifacts` to `true`

## Notes

- No CI job in this repo's `.circleci/config.yml` lints or tests shell scripts directly. Verify by hand (or rely on node's parity test) that both `engine.mode=shell` and `engine.mode=native` still behave identically after this change.
