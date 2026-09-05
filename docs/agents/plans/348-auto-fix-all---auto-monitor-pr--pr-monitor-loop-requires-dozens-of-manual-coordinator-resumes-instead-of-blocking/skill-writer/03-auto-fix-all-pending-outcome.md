# auto-fix-all: new OUTCOME=pending bubbles up from the per-issue architect

This is the actual reported bug: inside `auto-fix-all`'s pipeline, `process_one_issue.md`'s "Monitor the PR" step reads `auto-monitor-issue-pr/steps/run.md` **directly** (already running as the per-issue `architect` subagent, per this repo's nested-skill convention — no separate `Agent(architect)` spawn, no `SKILL.md` coordinator layer involved). That subagent has no `ScheduleWakeup`, so it cannot itself reschedule on `pending` — it must stop and hand the wait back to the top-level `auto-fix-all` coordinator, exactly like the existing `OUTCOME=blocked`/`OUTCOME=closed` outcomes already do.

## Change `process_one_issue.md`'s "Monitor the PR" section

Where it currently reads `auto-monitor-issue-pr/steps/run.md` and expects it to block until a terminal outcome: since that nested read now also calls the one-shot check directly (per step 02's `SKILL.md`/`steps/run.md` rework, reused here in its nested form), it can return `pending` too. Add:

> On `pending`: stop processing this issue immediately and report `OUTCOME=pending PR_NUMBER=<pr_number>` at the top level — do not loop or retry internally, and do not go back to "Monitor the PR" yourself.

The existing `merged`/`closed`/`approved`/`commented` branches stay exactly as they are today.

## Change `auto-fix-all/SKILL.md`'s Step 3 ("React to the outcome")

Add a new branch, modeled directly on the existing `OUTCOME=blocked` retry branch (which already documents that `process_one_issue.md`'s branch/PR reuse lets a fresh architect "naturally resume from where the block occurred rather than starting over"):

> ### `OUTCOME=pending PR_NUMBER=<n>`
>
> The PR isn't at a terminal state yet — nothing to do until it is. Do **not** pop the queue (the id stays at the front, still in progress). Call `ScheduleWakeup(delaySeconds=<poll_interval>, prompt="/auto-fix-all", reason="waiting for PR #<n> to reach a terminal state")` and stop. (Requires `auto-fix-all` to have been invoked via `/loop /auto-fix-all <ids>`, same as the existing `clear_context` wakeup.) The next wakeup re-invokes `/auto-fix-all` fresh with no arguments, which re-reads the queue (Step 1's "no arguments" branch) and spawns a brand-new `architect` agent for the same id at Step 2 — `process_one_issue.md`'s existing idempotent guards (branch reuse in `checkout_from_main.sh`, "plan already exists" skip, PR already exists) let it fast-forward straight back to "Monitor the PR" with no wasted rework, then perform one more one-shot check.

This deliberately mirrors `clear_context`'s existing "fresh architect, no accumulated context" reschedule rather than resuming the same subagent via `SendMessage` — resuming the same subagent's conversation on every wakeup would reproduce the exact growing-context problem this issue is about.

## Files to Change

- `auto-fix-all/steps/process_one_issue.md` — "Monitor the PR" section: add the `pending` → `OUTCOME=pending PR_NUMBER=<n>` branch.
- `auto-fix-all/SKILL.md` — Step 3: add the new `OUTCOME=pending PR_NUMBER=<n>` branch (no queue pop, `ScheduleWakeup` re-invoking `/auto-fix-all`).

## Notes

- This branch needs no user interaction (unlike `closed`/`blocked`) — it's purely a "come back later" signal, so it belongs alongside `OUTCOME=merged`'s clear_context handling in spirit, but without popping the queue.
- If `auto-fix-all` was *not* invoked via `/loop`, `ScheduleWakeup` has nothing to fire into — flag this the same way the existing `clear_context` step's parenthetical already does, rather than silently doing nothing.
