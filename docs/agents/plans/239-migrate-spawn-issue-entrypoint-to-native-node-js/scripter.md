# scripter Plan: Migrate spawn-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Routing key `spawn-issue` (already present, `false`, in `arcanum/_lib/migration-status.json`) — flip to `true` only once node's `core/bin/arcanum spawn-issue` implementation (plan.md's node steps) is in place, so the shim's native branch has something real to dispatch to.
- The shim must forward `HOME` to the native branch (see plan.md's "Shared contracts") and pass `<repo_path> <parent_id> <title> <body_file> [--as-subissue]` through unchanged and symmetrically on both branches — no argument reshaping needed, since this script (unlike `resolve_plan_paths.sh` in #235) already takes `repo_path` as its leading arg today.

## Implementation Steps

### Step 1 — Introduce the engine_dispatch shim

`arcanum/_lib/spawn_issue.sh` has no shim today (no `engine_dispatch` sourcing, absent from the `*_shell.sh` sibling list). Following the `resolve_plan_paths.sh`/`resolve_plan_paths_shell.sh` split from #235:

- Rename the current script's full logic, unchanged, to `arcanum/_lib/spawn_issue_shell.sh`.
- Add a new thin `arcanum/_lib/spawn_issue.sh` shim: sources `engine_dispatch.sh`, then calls
  ```bash
  engine_dispatch "$REPO_PATH" spawn-issue "${SCRIPT_DIR}/spawn_issue_shell.sh" HOME -- "$@"
  ```
  (after the shim's own usage/arg validation — keep the existing `Usage: $0 <repo_path> <parent_id> <title> <body_file> [--as-subissue]` guard here, shim-side, per the same precedent).
- No caller updates needed: every existing call site (`discuss-issue/steps/discuss_and_save.md`, `enhance-issue`, `auto-new-issue`, `arcanum-split-issue`) already invokes `spawn_issue.sh <repo_path> ...` with `repo_path` as the first arg — the shim's external signature is unchanged.

### Step 2 — Flip the migration-status flag and regenerate docs

- Flip `spawn-issue` from `false` to `true` in `arcanum/_lib/migration-status.json`, once node's `core/bin/arcanum spawn-issue` is merged/ready in the same branch.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.

## Files to Change
- `arcanum/_lib/spawn_issue.sh` — replaced with the thin shim.
- `arcanum/_lib/spawn_issue_shell.sh` — new; today's full script logic, unchanged.
- `arcanum/_lib/migration-status.json` — `spawn-issue: false` → `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.

## Notes
- Do this only after #237/PR #248 merges and node's implementation (plan.md's node steps) lands in this same branch — flipping the flag before `SpawnIssue.js` exists would route real calls to a missing native command.
