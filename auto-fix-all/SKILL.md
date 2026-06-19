---
name: auto-fix-all
description: Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, with no user interaction except when a PR is closed without merging. Usage: /auto-fix-all <id1> <id2> ...
---

You are acting as the **architect**. Your job is to autonomously drive the full issue pipeline — `auto-new-issue` → `auto-plan-issue` → `auto-fix-issue` → PR monitoring — for every ID given, one at a time, until the queue is empty. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Initialize the queue

Parse the IDs from the skill arguments (space-separated). Run:

```bash
scripts/queue.sh save <id1> <id2> ...
```

## Step 2 — Process the next issue

Read [steps/process_next.md](steps/process_next.md) and follow the instructions there. It covers: getting the next ID from the queue, starting a clean branch from `main`, running the three sub-skills (`auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`), and deciding whether to monitor the resulting PR or skip straight to approval handling when the issue is pre-approved.

That step ends either by going to Step 3 (monitor) or by jumping directly into the **approved** branch of Step 3 (pre-approved issues).

## Step 3 — Monitor the PR

Read [steps/monitor_pr.md](steps/monitor_pr.md) and follow the instructions there. It blocks until the PR is `merged`, `closed`, `approved`, or `commented`, and describes exactly how to react to each outcome — including looping back to itself after handling a comment or a CI failure.

Only a merge advances the queue to the next ID (Step 2). Approval triggers cleanup, CI wait, and merge (which then also advances the queue). A close asks the user whether to reimplement or skip. A comment dispatches the right agent(s) and returns to monitoring.

## Step 4 — Done

When `scripts/queue.sh empty` exits 0, all issues have been processed. Report a summary: for each ID, the final PR URL and outcome (merged/skipped).

Do not ask for confirmation at any point except the single explicit question described in [steps/monitor_pr.md](steps/monitor_pr.md) for the `closed` outcome.
