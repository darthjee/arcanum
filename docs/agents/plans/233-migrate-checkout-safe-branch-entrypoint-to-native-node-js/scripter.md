# scripter Plan: Migrate checkout-safe-branch entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The shim's `engine_dispatch` call must use the exact command key `checkout-safe-branch`, matching node's `COMMANDS` registry entry and the `migration-status.json` key.
- The renamed shell script must be named `arcanum/_lib/checkout_safe_branch_shell.sh` — node's parity test targets this exact path.
- No env-var allowlist entries needed in the `engine_dispatch` call (this entrypoint has no environment dependency).

## Implementation Steps

### Step 1 — Turn `checkout_safe_branch.sh` into an `engine_dispatch` shim

Follow the pattern established in `arcanum/_lib/resolve_id_and_file.sh` (issue #227):

1. Rename `arcanum/_lib/checkout_safe_branch.sh` to `arcanum/_lib/checkout_safe_branch_shell.sh`, content unchanged (this becomes the shell fallback implementation).
2. Create a new `arcanum/_lib/checkout_safe_branch.sh` — a thin shim that sources `engine_dispatch.sh` and calls:
   ```bash
   engine_dispatch "$REPO_PATH" checkout-safe-branch "${SCRIPT_DIR}/checkout_safe_branch_shell.sh" -- "$@"
   ```
   Keep the same `<repo_path>` CLI signature and the same header-comment documentation style as `resolve_id_and_file.sh`, cross-referencing `docs/agents/architecture/script-engine.md` and this plan's directory.
3. No caller updates needed — `discuss-issue/steps/discuss_and_save.md`, `enhance-issue/steps/publish.md`, `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md`, and `arcanum/_lib/resolve_and_fetch_shell.sh` all invoke `checkout_safe_branch.sh <repo_path>` by its stable path/signature, which the shim preserves.

### Step 2 — Flip the migration flag and regenerate the status doc

Once node's `checkout-safe-branch` command and parity test are in place and passing, flip `"checkout-safe-branch"` from `false` to `true` in `arcanum/_lib/migration-status.json`, then run `scripts/generate_entrypoint_migration_status.sh` to regenerate `docs/agents/architecture/entrypoint-migration-status.md` (updates the `checkout-safe-branch` row to `Yes` / `#233`). Commit the regenerated doc alongside the flag flip.

## Files to Change

- `arcanum/_lib/checkout_safe_branch_shell.sh` — renamed from `checkout_safe_branch.sh`, content unchanged.
- `arcanum/_lib/checkout_safe_branch.sh` — new `engine_dispatch` shim.
- `arcanum/_lib/migration-status.json` — flip `checkout-safe-branch` to `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated (auto-generated, do not hand-edit).

## Notes

- Step 2 must land after node's command is wired and its parity test passes — flipping the flag before that would route real callers to a half-built native path.
