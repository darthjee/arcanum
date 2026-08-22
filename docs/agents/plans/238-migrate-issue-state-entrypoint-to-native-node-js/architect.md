# architect Plan: Migrate issue-state entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Flips `arcanum/_lib/migration-status.json`'s `issue-state` key from `false` to `true` — only once node's `IssueState.js`/`core/bin/arcanum` changes and scripter's shim are both in place and their tests pass. Flipping it earlier would route production `issue_state.sh` calls to a nonexistent/incomplete native path whenever `engine.mode=native` is configured.
- Regenerates `docs/agents/architecture/entrypoint-migration-status.md` from that same file, via the existing generator script — no manual edits to the doc.

## Implementation Steps

### Step 1 — Flip the migration-status flag

In `arcanum/_lib/migration-status.json`, change:
```json
"issue-state": false,
```
to:
```json
"issue-state": true,
```
Do this last, after confirming node's and scripter's changes are complete and their tests (unit + parity) pass.

### Step 2 — Regenerate the migration status doc

Run `scripts/generate_entrypoint_migration_status.sh` from the repo root to regenerate `docs/agents/architecture/entrypoint-migration-status.md` from the updated `migration-status.json`. Commit the regenerated doc as-is — do not hand-edit it.

## Files to Change

- `arcanum/_lib/migration-status.json` — flip `issue-state` to `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output (no manual edits).

## Notes

- This is the last step to land in this issue's PR — it's the "go live" switch for the native path, and depends on both other agents' work being done and green.
