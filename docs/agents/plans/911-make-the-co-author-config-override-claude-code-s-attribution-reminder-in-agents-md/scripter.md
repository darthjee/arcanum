# Scripter Plan: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

Main plan: [plan.md](plan.md)

## Shared contracts

This agent produces two things, both defined in [plan.md](plan.md#shared-contracts):

- the shim `init-claude/scripts/ensure_coauthor_policy.sh <repo_path>`
- migration `next/004`

They rely on the node agent's `init-claude-ensure-coauthor-policy` command and its `COAUTHOR_POLICY=...` output, passed through unchanged.

## Implementation Steps

### Step 1 — Native-only shim and status entry

Add `init-claude/scripts/ensure_coauthor_policy.sh`, a thin `engine_dispatch --native-only` shim. Copy the header-comment style and argument check of `init-claude/scripts/set_next_step_clear.sh`. Add `"init-claude-ensure-coauthor-policy": "docker"` to `arcanum/_lib/migration-status.json`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` with its `scripts/generate_*.sh`. Never hand-edit that file.

### Step 2 — Migration next/004

Add `arcanum/migrations/repos/next/004.sh`, in the same `config`/`run` shape as `next/001.sh`, and `004.md`. `004.md` explains:

- why the line exists: hand commits otherwise follow Claude Code's attribution reminder
- that it is skippable and safe to re-run
- that a repo without AGENTS.md is left untouched

Append the 004 entry to `arcanum/migrations/repos/next/migrations.json`. `run` resolves the shim from `SCRIPT_DIR`, never from cwd, and passes `"$PWD"` as the repo path.

## Files to Change

- `init-claude/scripts/ensure_coauthor_policy.sh` — new shim.
- `arcanum/_lib/migration-status.json` — status entry.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated, not hand-edited.
- `arcanum/migrations/repos/next/004.sh`, `004.md` — new migration.
- `arcanum/migrations/repos/next/migrations.json` — register 004.

## Notes

- Check that `scripts/bump-version.sh` handles the `../../../../init-claude` depth when it renames `next/` (the depth stays the same).
