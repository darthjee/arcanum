---
name: auto-monitor-pr
description: Monitors a given PR for merge/close/approval/new owner comments with one bounded check per invocation, rescheduling itself via ScheduleWakeup until one of those occurs, then reports the outcome. Tracks each owner comment's open/addressed lifecycle with :eyes:/:+1: reactions on the comment itself, but leaves deciding how to address a comment to the caller. Usage: /auto-monitor-pr <pr_number>
---

You are the coordinator. This skill now performs a single bounded check per invocation instead of blocking, so there is nothing left worth delegating to a spawned `architect` agent — run the check directly at this layer.

## Step 1 — Resolve REPO_PATH and parse arguments

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd — resolved fresh on every invocation, including each `ScheduleWakeup` re-entry below.

Parse the raw skill arguments: the first token is `<pr_number>` (accepted with or without a leading `#`); an optional second token is `<id>` (an issue id), forwarded as `--issue-id <id>` in Step 2 when present.

## Step 2 — Run one bounded check

Read [steps/run.md](steps/run.md) (resolved relative to this skill folder) and follow it directly for `<pr_number>` (and `<id>` if given), carrying `REPO_PATH` forward — do not spawn `Agent(architect)` for this. It runs `scripts/monitor_pr.sh` once and reports either `pending` or a terminal outcome (`merged`/`closed`/`approved`, or `commented` followed by one `---`-separated block per new comment) verbatim.

## Step 3 — React to the result

- **`pending`**: nothing terminal happened this pass. Call `ScheduleWakeup(delaySeconds=300, prompt="/auto-monitor-pr <original raw arguments>", reason="waiting for PR to reach a terminal state")` and stop. (Requires `auto-monitor-pr` to have been invoked via `/loop /auto-monitor-pr <pr_number>` for the wakeup to actually fire — flag this clearly instead of silently doing nothing if it wasn't.)
- **Terminal outcome** (`merged`/`closed`/`approved`/`commented`): report it to the caller verbatim — do not summarize, reinterpret, or decide what to do about any comment it reports.
