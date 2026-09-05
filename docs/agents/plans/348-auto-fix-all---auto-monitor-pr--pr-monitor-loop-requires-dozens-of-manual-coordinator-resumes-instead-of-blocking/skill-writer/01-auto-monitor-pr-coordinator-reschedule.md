# auto-monitor-pr: coordinator checks directly and reschedules on pending

Today `auto-monitor-pr/SKILL.md` unconditionally spawns `Agent(architect)` to run `steps/run.md`, which blocks internally on `monitor_pr.sh`. Since the script no longer blocks (it does one bounded check and may return `pending`), the coordinator no longer needs to delegate the check itself to an architect subagent — it can run it directly, the same way `auto-fix-all/SKILL.md` already runs `queue.sh`/`config.sh` directly at the coordinator layer.

Rework `auto-monitor-pr/SKILL.md` + `steps/run.md`:

- `SKILL.md`: resolve `REPO_PATH`, parse `<pr_number>`/`<id>` from the raw skill arguments, then call `scripts/monitor_pr.sh "$REPO_PATH" --pr-number <pr_number> [--issue-id <id>]` directly (no `Agent(architect)` spawn for this).
- On `pending`: call `ScheduleWakeup(delaySeconds=<poll_interval>, prompt="/auto-monitor-pr <original raw arguments>", reason="waiting for PR to reach a terminal state")` and stop. (Requires the skill to have been invoked via `/loop /auto-monitor-pr ...` for the wakeup to actually fire — document this.)
- On a terminal outcome (`merged`/`closed`/`approved`/`commented`): report it to the caller verbatim, exactly as `steps/run.md`'s current "Step 2 — Report" already documents — no decision-making about comments, same as today.
- `steps/run.md` becomes either redundant (if all of its logic now lives directly in `SKILL.md`) or a thin description of the same two bullets above, whichever keeps the skill's existing "SKILL.md = coordinator layer, steps/run.md = architect layer" convention closest to intact — judgment call, but the important part is that no subagent is spawned merely to run one bounded check.

## Files to Change

- `auto-monitor-pr/SKILL.md` — run the check directly at the coordinator layer instead of spawning `Agent(architect)`; add the `pending` → `ScheduleWakeup` branch.
- `auto-monitor-pr/steps/run.md` — update to describe the new single-check contract (no more "blocks internally"); fold into `SKILL.md` or keep as a thin reference, per the judgment call above.
