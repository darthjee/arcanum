# auto-monitor-issue-pr: same treatment for its own coordinator

`auto-monitor-issue-pr` has the same coordinator/architect split as `auto-monitor-pr` (see step 01), and its `steps/run.md` currently just resolves the PR number then delegates into `auto-monitor-pr/steps/run.md`'s (previously blocking) logic. Apply the same restructuring here, for its own **standalone** invocation path (`/auto-monitor-issue-pr <id>` called directly, spawning its own coordinator-level `Agent(architect)` today) — the nested case (called from inside `auto-fix-all`'s per-issue architect subagent) is handled separately in step 03, since that path never goes through this skill's own `SKILL.md` coordinator layer at all.

Rework `auto-monitor-issue-pr/SKILL.md` + `steps/run.md`:

- `SKILL.md`: resolve `REPO_PATH`, parse `<id>`, run `scripts/resolve_pr_number.sh "$REPO_PATH" <id>` directly, then run `auto-monitor-pr/scripts/monitor_pr.sh "$REPO_PATH" --pr-number <pr_number> --issue-id <id>` directly — no `Agent(architect)` spawn, same reasoning as step 01.
- On `pending`: `ScheduleWakeup(delaySeconds=<poll_interval>, prompt="/auto-monitor-issue-pr <id>", reason="waiting for PR to reach a terminal state")`, stop.
- On a terminal outcome: report verbatim, exactly as `steps/run.md`'s current "Step 3 — Report" already documents.
- Keep the existing "Permission-rule gotcha" note from `steps/run.md` (about wildcarding `resolve_pr_number.sh`/`monitor_pr.sh` permission rules) — it still applies, now at the coordinator layer instead of inside a spawned architect.

## Files to Change

- `auto-monitor-issue-pr/SKILL.md` — run the PR-number resolution and the check directly at the coordinator layer instead of spawning `Agent(architect)`; add the `pending` → `ScheduleWakeup` branch.
- `auto-monitor-issue-pr/steps/run.md` — update to describe the new single-check contract; fold into `SKILL.md` or keep as a thin reference, same judgment call as step 01. Preserve the existing permission-rule gotcha note.
