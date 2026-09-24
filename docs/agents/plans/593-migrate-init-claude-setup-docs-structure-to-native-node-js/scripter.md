# Scripter Plan: Migrate init-claude setup-docs-structure to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- You produce `init-claude/scripts/setup_docs_structure_shell.sh`: the current `setup_docs_structure.sh` body, moved verbatim (same stdout/stderr/exit code). The node parity spec runs it directly from the project dir.
- You produce the shim: `setup_docs_structure.sh` calls `engine_dispatch "$PWD" init-claude-setup-docs-structure "${SCRIPT_DIR}/setup_docs_structure_shell.sh" --prepend-repo-path -- "$@"`, with no env allowlist.
- Command name `init-claude-setup-docs-structure`. node registers it in `core/lib/core/commands.js`.

## Implementation Steps

### Step 1 — Split the implementation and add the shim
- `git mv init-claude/scripts/setup_docs_structure.sh init-claude/scripts/setup_docs_structure_shell.sh` (keep it executable). Its logic stays unchanged. Update its header comment so the created-files list includes `docs/agents/arcanum-split-issue.md` (currently missing) and so it notes that it is the shell implementation behind the `setup_docs_structure.sh` shim.
- Write a new `init-claude/scripts/setup_docs_structure.sh` modeled line for line on `init-claude/scripts/setup_templates.sh`. The header comment describes the command, points at `script-engine.md` and this plan, and explains why `"$PWD"` (not `git rev-parse --show-toplevel`) is passed with `--prepend-repo-path`. It also notes there is no env allowlist and describes the unchanged output contract (see [plan.md](plan.md)). Then `source` `arcanum/_lib/engine_dispatch.sh`, set `REPO_PATH="$PWD"`, and call `engine_dispatch` as in the shared contract. Keep it executable.
- Callers in `init-claude/SKILL.md`/steps invoke `setup_docs_structure.sh`, which is unchanged. Grep to confirm nothing references the script in a way that needs updating.

### Step 2 — Flip the migration status and regenerate the doc
- In `arcanum/_lib/migration-status.json`, set `"init-claude-setup-docs-structure": true`.
- Run `scripts/generate_entrypoint_migration_status.sh` to regenerate `docs/agents/architecture/entrypoint-migration-status.md`. The `init-claude-setup-docs-structure` row should become `Yes`.
- Manually check routing: from a scratch dir with an `AGENTS.md`, run the shim under `engine.mode=shell` and `engine.mode=native` and diff stdout, stderr, exit codes and resulting trees. Do this after node's command lands, or coordinate with node.

## Files to Change
- `init-claude/scripts/setup_docs_structure_shell.sh` — new (moved) shell implementation; header comment fixed.
- `init-claude/scripts/setup_docs_structure.sh` — rewritten as a thin `engine_dispatch` shim.
- `arcanum/_lib/migration-status.json` — key flipped to `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.

## Notes
- Do not change any generated file content or the `AGENTS.md` section text (e.g. the dangling `docs/agents/folder-structure.md` link stays). The issue puts that out of scope.
