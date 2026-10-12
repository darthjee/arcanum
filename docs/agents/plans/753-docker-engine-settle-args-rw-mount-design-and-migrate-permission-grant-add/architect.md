# Architect Plan: Docker engine: settle args:rw mount design and migrate permission-grant-add

Main plan: [plan.md](plan.md)

## Shared contracts

- The `rw-mkdir` mode and its semantics, exactly as in [plan.md](plan.md#shared-contracts). `rw` stays unchanged.
- The declarations: `permission-grant-add` → `--path-arg=2:rw-mkdir`, `write-label-config-*` → `--path-arg=1:rw-mkdir`, `render-issue` → stays `rw`.

## Implementation Steps

### Step 1 — Correct mounts.md and document the out-of-repo design

In `docs/agents/specs/docker/mounts.md` (the "rest of `CLAUDE_CONFIG_DIR`" bullet, ~line 27), replace "gets only that file, through `args:rw`" with the facts:
- The global `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` write is done in-process by migrations (`arcanum/migrations/repos/*/00N.sh` `source` `permission_grant.sh` and call `permission_grant_add`), so it never goes through dispatch.
- The dispatched callers (`init-claude/setup_permissions.md`, `init-claude/setup_specialist_dispatch_permissions.md`) target the repo's own `.claude/settings.json`, which the repo mount covers.
- Dispatching `permission-grant-add` against an out-of-repo file mounts its parent directory read-write. For the global settings file, that is all of `CLAUDE_CONFIG_DIR`. This is an accepted, documented cost, not a current use. A single-file mount can't work, because `PermissionGrant` needs `<file>.tmp` + rename and `<file>.lock` next to the file.

### Step 2 — dispatch.md rw-mkdir mode and checklist row

- `docs/agents/specs/docker/dispatch.md` → Argument path declaration: document `<mode>` as `ro|rw|rw-mkdir`. Add a table row for "outside the repo, `rw-mkdir`": like `rw`, but a missing parent is created on the host (`mkdir -p`) before mounting, for writers that `mkdir -p` natively. Keep "Missing parent: not mounted, same failure as natively" for plain `rw` and say it is for writers that don't create the parent. Collapsing treats `rw-mkdir` as `rw`. Update the `--path-arg` row in the flags table if it lists modes.
- `docs/agents/specs/docker/checklist.md`:
  - Add a line to the `args:ro`/`args:rw` legend saying `args:rw` covers both `rw` and `rw-mkdir`.
  - Tick the `permission-grant-add` row ✅ with issue `#753` and notes per the shared contract (`--path-arg=2:rw-mkdir`; relative `<file>` assumes cwd = `<anchor>`, since dispatch resolves against `$PWD` and `PermissionGrant` against `<anchor>`; an out-of-repo target exposes its parent rw).
  - Update the three `init-claude-write-label-config-*` rows' notes from `--path-arg=1:rw` to `--path-arg=1:rw-mkdir` (a missing parent directory is created, matching native).
- If `docs/agents/architecture/entrypoint-migration-status.md` lists per-command status, update `permission-grant-add` to match.

## Files to Change

- `docs/agents/specs/docker/mounts.md` — correct the `CLAUDE_CONFIG_DIR` bullet
- `docs/agents/specs/docker/dispatch.md` — `rw-mkdir` mode in Argument path declaration
- `docs/agents/specs/docker/checklist.md` — legend, `permission-grant-add` tick, `write-label-config-*` notes
- `docs/agents/architecture/entrypoint-migration-status.md` — only if it tracks this command's status

## Notes

- The issue's premise that a dispatched call writes the global file turned out to be wrong. Nothing dispatched writes outside the repo today, so the out-of-repo design is documentation only.
