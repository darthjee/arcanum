---
name: auto-fix-all
description: Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, forever — waiting for new IDs to be pushed onto the queue whenever it runs dry — with no user interaction except when a PR is closed without merging. Usage: /auto-fix-all <id1> <id2> ...
---

You are acting as the **architect**. Your job is to autonomously drive the full issue pipeline — `auto-new-issue` → `auto-plan-issue` → `auto-fix-issue` → PR monitoring — for every ID given, one at a time, forever. The queue never runs out on its own: when it's empty, the next step simply waits for more IDs to be pushed onto it (e.g. via `push-issue-to-queue`). Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Initialize the queue

If skill arguments were provided (space-separated IDs), run:

```bash
scripts/queue.sh save <id1> <id2> ...
```

If no arguments were given, this is a re-invocation after context clearing — the queue already contains the remaining issues. Skip this step and go directly to Step 2.

## Step 2 — Process the next issue

Read [steps/process_next.md](steps/process_next.md) and follow the instructions there. It covers: getting the next ID from the queue, starting a clean branch from `main`, running the three sub-skills (`auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`), and deciding whether to monitor the resulting PR or skip straight to approval handling when the issue is pre-approved.

That step ends either by going to Step 3 (monitor) or by jumping directly into the **approved** branch of Step 3 (pre-approved issues).

## Step 3 — Monitor the PR

Read [steps/monitor_pr.md](steps/monitor_pr.md) and follow the instructions there. It blocks until the PR is `merged`, `closed`, `approved`, or `commented`, and describes exactly how to react to each outcome — including looping back to itself after handling a comment or a CI failure.

Only a merge advances the queue to the next ID (Step 2). Approval triggers cleanup, CI wait, and merge (which then also advances the queue). A close asks the user whether to reimplement or skip. A comment dispatches the right agent(s) and returns to monitoring.

## Step 4 — Done

This skill runs forever by design — Step 2 blocks and waits whenever the queue is empty instead of stopping, so issues pushed onto the queue later are still picked up. This step is only reached if the run is stopped externally (e.g. the user interrupts it): report a summary at that point, for each ID processed so far, of the final PR URL and outcome (merged/skipped).

Do not ask for confirmation at any point except the single explicit question described in [steps/monitor_pr.md](steps/monitor_pr.md) for the `closed` outcome.
