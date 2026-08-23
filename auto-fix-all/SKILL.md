---
name: auto-fix-all
description: Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, forever — waiting for new IDs to be pushed onto the queue whenever it runs dry — with no user interaction except when a PR is closed without merging or a specialist dispatch is blocked. Usage: /auto-fix-all <id1> <id2> ...
---

You are the coordinator. Your job is to manage the queue and the things the `architect` agent cannot do itself (`ScheduleWakeup` between issues, asking the user what to do about a closed PR, asking the user what to do about a blocked specialist dispatch) — everything else (implementation, PR review, comments, CI) is delegated to a spawned `architect` agent, one per issue. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 0 — Resolve REPO_PATH

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd. This coordinator layer runs every script call in this file directly (not via a spawned architect for its own queue/config bookkeeping), so `REPO_PATH` must be resolved fresh here on every invocation (including each `ScheduleWakeup` re-entry, since a fresh invocation is a fresh trust point) and threaded explicitly through every script call below, plus into the per-issue `Agent(architect, ...)` spawn in Step 2.

## Step 1 — Initialize the queue

If skill arguments were provided (space-separated IDs), run:

```bash
scripts/queue.sh save "$REPO_PATH" <id1> <id2> ...
```

If no arguments were given, this is a re-invocation after context clearing — the queue already contains the remaining issues. Skip this step and go directly to Step 2.

## Step 2 — Process the next issue

Get the next id (blocks until the queue has one — if it's currently empty, it sleeps 5 seconds and checks again, forever, so a run that drains the queue keeps waiting for issues pushed onto it later, e.g. via `push-issue-to-queue`, instead of exiting). A queue draining with `finish_on_empty_queue` on is intercepted one step earlier, in Step 3 below, right after the previous issue's id is popped — so this call is only ever reached when the run genuinely wants to keep waiting:

```bash
scripts/queue.sh wait-next "$REPO_PATH"
```

Call this id `<id>`. Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/process_one_issue.md (resolved relative to the `auto-fix-all` skill folder) and follow it for issue <id>. REPO_PATH: <resolved_path>. Report OUTCOME=merged, OUTCOME=closed PR_NUMBER=<n>, or OUTCOME=blocked AGENT=<agent-name> ACTION=<description>.")

Wait for the agent to finish, then parse `OUTCOME` from its report, and proceed to Step 3.

## Step 3 — React to the outcome

### `OUTCOME=merged`

```bash
scripts/queue.sh pop "$REPO_PATH"
```

Check whether the run should finish now that the queue may be empty:

```bash
scripts/queue.sh empty "$REPO_PATH" && scripts/config.sh is-enabled "$REPO_PATH" finish_on_empty_queue
```

- **Exit 0 (both true)**: the queue is empty and the user has opted into finishing instead of waiting. Skip the `clear_context` check below entirely — no `ScheduleWakeup`, no looping back to Step 2. Go straight to Step 4 and report the summary.
- **Exit 1 (otherwise)**: continue to the `clear_context` check below, unchanged.

Check whether to clear context:

```bash
scripts/config.sh is-enabled "$REPO_PATH" clear_context
```

- **Exit 0 (`true`)**: call `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")` and stop. Do not loop back to Step 2. (Requires that `auto-fix-all` was invoked via `/loop /auto-fix-all <ids>`; the 60-second wakeup fires a fresh iteration that reads the queue and continues.)
- **Exit 1 (`false` or absent)**: go back to Step 2 to process the next issue.

### `OUTCOME=closed PR_NUMBER=<n>`

This is one of the two points in the whole pipeline where you ask the user something — the spawned architect agent cannot, so it stopped and handed this back to you.

> PR #`<n>` for issue `<id>` was closed without merging. What would you like to do?
> 1. Reimplement from scratch (start over from a clean `main` for this issue)
> 2. Skip this issue and move on to the next one

- **Reimplement** — the rejected branch must be discarded first, since `process_one_issue.md`'s branch bootstrap now reuses an existing `issue-<id>` branch instead of always recreating it:
  ```bash
  scripts/github.sh cleanup-branch "$REPO_PATH" <id>
  ```
  Then go back to Step 2 (the id stays at the front of the queue; a fresh `architect` agent will find no existing `issue-<id>` branch and create a genuinely clean one from `main` via `process_one_issue.md`).
- **Skip** — `scripts/queue.sh pop "$REPO_PATH"`, then go back to Step 2.

### `OUTCOME=blocked AGENT=<agent> ACTION=<description>`

This is the other point in the pipeline where you ask the user something — a specialist dispatch was denied by Claude Code's own permission classifier, so the spawned architect agent stopped instead of silently doing the work itself.

> A specialist dispatch to `<agent>` was blocked while processing issue `<id>` (action: `<description>`). What would you like to do?
> 1. Retry (e.g. after granting the needed permission out-of-band)
> 2. Skip this issue and move on to the next one

- **Retry** — go back to Step 2 and re-spawn a fresh `architect` agent for the same `<id>`. `process_one_issue.md`'s branch bootstrap already reuses an existing `issue-<id>` branch/PR, so this naturally resumes from where the block occurred rather than starting over.
- **Skip** — `scripts/queue.sh pop "$REPO_PATH"`, then go back to Step 2, same as the `closed` branch's skip option above.

Deliberately no "do it yourself" option here — that would recreate the exact behavior this outcome exists to prevent. If it's ever wanted, it should be a separate, explicit decision made in the open by a human, not a default silently offered right back on every block.

## Step 4 — Done

This skill runs forever by design — Step 2 blocks and waits whenever the queue is empty instead of stopping, so issues pushed onto the queue later are still picked up. This step is reached either when the run is stopped externally (e.g. the user interrupts it) or when the queue emptied with `finish_on_empty_queue` on (Step 3 above): report a summary at that point, for each ID processed so far, of the final PR URL and outcome (merged/skipped). No separate message distinguishes the `finish_on_empty_queue` case from an externally-interrupted run.

Do not ask for confirmation at any point except the two explicit questions above, for the `closed` and `blocked` outcomes.
