---
name: auto-fix-all
description: Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, forever — waiting for new IDs to be pushed onto the queue whenever it runs dry — with no user interaction except when a PR is closed without merging. Usage: /auto-fix-all <id1> <id2> ...
---

You are the coordinator. Your job is to manage the queue and the two things the `architect` agent cannot do itself (`ScheduleWakeup` between issues, asking the user what to do about a closed PR) — everything else (implementation, PR review, comments, CI) is delegated to a spawned `architect` agent, one per issue. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Initialize the queue

If skill arguments were provided (space-separated IDs), run:

```bash
scripts/queue.sh save <id1> <id2> ...
```

If no arguments were given, this is a re-invocation after context clearing — the queue already contains the remaining issues. Skip this step and go directly to Step 2.

## Step 2 — Process the next issue

Get the next id (blocks until the queue has one — if it's currently empty, it sleeps 5 seconds and checks again, forever, so a run that drains the queue keeps waiting for issues pushed onto it later, e.g. via `push-issue-to-queue`, instead of exiting):

```bash
scripts/queue.sh wait-next
```

Call this id `<id>`. Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/process_one_issue.md (resolved relative to the `auto-fix-all` skill folder) and follow it for issue <id>. Report OUTCOME=merged or OUTCOME=closed PR_NUMBER=<n>.")

Wait for the agent to finish, then parse `OUTCOME` from its report, and proceed to Step 3.

## Step 3 — React to the outcome

### `OUTCOME=merged`

```bash
scripts/queue.sh pop
```

Check whether to clear context:

```bash
scripts/config.sh is-enabled clear_context
```

- **Exit 0 (`true`)**: call `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")` and stop. Do not loop back to Step 2. (Requires that `auto-fix-all` was invoked via `/loop /auto-fix-all <ids>`; the 60-second wakeup fires a fresh iteration that reads the queue and continues.)
- **Exit 1 (`false` or absent)**: go back to Step 2 to process the next issue.

### `OUTCOME=closed PR_NUMBER=<n>`

This is the one point in the whole pipeline where you ask the user something — the spawned architect agent cannot, so it stopped and handed this back to you.

> PR #`<n>` for issue `<id>` was closed without merging. What would you like to do?
> 1. Reimplement from scratch (start over from a clean `main` for this issue)
> 2. Skip this issue and move on to the next one

- **Reimplement** — go back to Step 2 (the id stays at the front of the queue; a fresh `architect` agent will check out a clean branch from `main` again via `process_one_issue.md`).
- **Skip** — `scripts/queue.sh pop`, then go back to Step 2.

## Step 4 — Done

This skill runs forever by design — Step 2 blocks and waits whenever the queue is empty instead of stopping, so issues pushed onto the queue later are still picked up. This step is only reached if the run is stopped externally (e.g. the user interrupts it): report a summary at that point, for each ID processed so far, of the final PR URL and outcome (merged/skipped).

Do not ask for confirmation at any point except the single explicit question above for the `closed` outcome.
