# Architect Plan: auto-fix-issue should allow continuation

Main plan: [plan.md](plan.md)

## Shared contracts

This agent produces the markdown changes that reference the new scripts. The shared state file path/schema and `issue_state.sh` script signature are defined in `plan.md` — use them exactly as specified there.

The architect does NOT implement scripts — those are the scripter's responsibility.

## Implementation Steps

### Step 1 — Update `auto-fix-issue/steps/run.md` to add step-resume logic

At the very top of `auto-fix-issue/steps/run.md` (before Step 1), add a **Step 0 — Resume check** section:

> Read `.claude/state/issue-<id>.json` (if it exists) and check the `step` field. If a step is recorded, skip directly to the next step after the recorded one. Canonical step names and their mapping to run.md steps are in `plan.md`'s shared contracts table.

Also update each of the 6 steps in `run.md` so that, after the step's boundary script completes successfully, the step records itself via `issue_state.sh`:

```bash
scripts/issue_state.sh set <id> step <step_name>
```

Resolve `scripts/issue_state.sh` relative to the `auto-fix-issue` skill folder.

Use the step names from the shared contracts table.

### Step 2 — Update `auto-monitor-pr/steps/run.md` to thread the issue id

`auto-monitor-pr/steps/run.md` currently calls `monitor_pr.sh <pr_number>`. Update it to accept an optional `<id>` argument and pass it through:

```bash
scripts/monitor_pr.sh <pr_number> [<id>]
```

The caller (`auto-monitor-issue-pr/steps/run.md`) already knows the issue id from its argument — thread it through.

Update `auto-monitor-issue-pr/steps/run.md` accordingly: pass `<id>` when delegating to `auto-monitor-pr/steps/run.md`.

### Step 3 — Update `docs/agents/architecture.md`

In the **Shared State & Configuration Files** table, replace the row for `.claude/state/auto-monitor-pr-<pr_number>-comments.json` with a row for `.claude/state/issue-<id>.json` that documents the unified schema (as in `plan.md`'s shared contracts). Also add a note explaining that `monitor-issues`' per-issue `updated_at`/`tags` entries and `auto-fix-issue`'s step field are stored here.

Remove the now-superseded `auto-monitor-pr-<pr_number>-comments.json` description from the table (or mark it deprecated if backward-compat mode is left in the script).

## Files to Change

- `auto-fix-issue/steps/run.md` — add Step 0 resume check; add `issue_state.sh set` call after each step's boundary script
- `auto-monitor-pr/steps/run.md` — pass `<id>` argument to `monitor_pr.sh`
- `auto-monitor-issue-pr/steps/run.md` — thread `<id>` through to `auto-monitor-pr/steps/run.md`
- `docs/agents/architecture.md` — update state files table

## Notes

- The architect does not touch any `.sh` files — those are all the scripter's responsibility.
- "Step 0" in `run.md` is prose-instruction only: it tells the architect-agent which step to jump to. No script is needed for this check; it is a simple JSON read via `issue_state.sh get`.
- If the `step` field is absent or the file doesn't exist, treat it as Step 1 (no resume).
- The scripter is responsible for `issue_state.sh` and for updating `monitor_pr.sh` and `monitor_issues.sh`. The architect only writes the markdown that calls them.
