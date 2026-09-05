# Skill-Writer Plan: auto-fix-all / auto-monitor-pr: PR-monitor loop requires dozens of manual coordinator resumes instead of blocking

Main plan: [plan.md](plan.md)

## Shared contracts

Every step below reacts to the new `pending` output from `monitor_pr.sh` (scripter's work) by rescheduling via `ScheduleWakeup` at whichever layer actually owns that tool, and otherwise keeps handling the four existing terminal outcomes (`merged`/`closed`/`approved`/`commented`) exactly as before.

## Steps

- [01 — auto-monitor-pr: coordinator checks directly and reschedules on pending](skill-writer/01-auto-monitor-pr-coordinator-reschedule.md)
- [02 — auto-monitor-issue-pr: same treatment for its own coordinator](skill-writer/02-auto-monitor-issue-pr-coordinator-reschedule.md)
- [03 — auto-fix-all: new OUTCOME=pending bubbles up from the per-issue architect](skill-writer/03-auto-fix-all-pending-outcome.md)

## Notes

- Pick one poll interval and use it consistently across all three call sites (e.g. 300s/5 minutes) — long enough that a multi-hour human review doesn't need excessive round-trips, short enough that a merge/comment is picked up reasonably promptly. This can become a `config.sh` setting later, but a fixed constant is enough to resolve this issue.
- All three call sites are only reachable this way when invoked via `/loop /<skill>` (so `ScheduleWakeup` re-entry actually fires) — same existing caveat `auto-fix-all/SKILL.md`'s `clear_context` step already documents; carry the same caveat into the standalone `auto-monitor-pr`/`auto-monitor-issue-pr` skill docs.
