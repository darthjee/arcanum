# scripter Plan: Migrate resolve-plan-paths entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- New signature for the public entrypoint: `resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>` — the new shim built here is what node's parity spec and skill-writer's updated call sites depend on.
- Registry key `resolve-plan-paths` — the `engine_dispatch` `<command>` arg and the `arcanum/_lib/migration-status.json` key node's `core/bin/arcanum` routing entry must match exactly.
- `Usage: resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>` is checked and printed only in this new shim, before `engine_dispatch` even runs — never reproduced by node or in any test.

## Implementation Steps

### Step 1 — Split the shell implementation and add the engine_dispatch shim

Rename `arcanum/_lib/resolve_plan_paths.sh` to `arcanum/_lib/resolve_plan_paths_shell.sh` (internal `find_existing_file`/output logic unchanged). Update its header comment to describe it as the shell implementation invoked via the new shim (same shape as `resolve_id_and_file_shell.sh`'s header). Add `repo_path` as its new leading arg (shifting `issues_folder`/`plans_folder`/`id` to `$2`/`$3`/`$4`), source `repo_path.sh`, and call `repo_path_enter "$REPO_PATH"` right after arg parsing — mirroring `resolve_id_and_file_shell.sh`'s exact pattern, so the relative `issues_folder`/`plans_folder` paths resolve correctly regardless of the caller's ambient cwd.

Create a new thin shim at `arcanum/_lib/resolve_plan_paths.sh`:
- `Usage: resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>`; validate all 4 are non-empty, else print the `Usage:` message to stderr and exit 1.
- Source `engine_dispatch.sh`.
- Call `engine_dispatch "$REPO_PATH" resolve-plan-paths "${SCRIPT_DIR}/resolve_plan_paths_shell.sh" -- "$@"` — passing the full original arg list (repo_path included) through, matching `resolve_id_and_file.sh`'s exact pattern. No extra env-var allowlist entries needed (purely filesystem-based, same as `resolve-id-and-file`/`list-agents`).

## Files to Change

- `arcanum/_lib/resolve_plan_paths.sh` → renamed to `arcanum/_lib/resolve_plan_paths_shell.sh`; gains `repo_path` as new leading arg + `repo_path_enter` call
- `arcanum/_lib/resolve_plan_paths.sh` — new, thin `engine_dispatch` shim

### Step 2 — Flip migration status and regenerate docs

Set `"resolve-plan-paths": true` in `arcanum/_lib/migration-status.json` (key already present). Run `scripts/generate_entrypoint_migration_status.sh` (repo root) to regenerate `docs/agents/architecture/entrypoint-migration-status.md`.

## Files to Change

- `arcanum/_lib/migration-status.json` — flip `resolve-plan-paths` to `true`
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated

## Notes

- The two thin per-skill wrapper scripts (`auto-plan-issue/scripts/resolve_plan_paths.sh`, `auto-fix-issue/scripts/resolve_plan_paths.sh`) need **no changes** — both already `exec ... "$@"` through unchanged regardless of arg count, so they automatically forward the new leading `repo_path` arg once skill-writer's callers start passing it.
