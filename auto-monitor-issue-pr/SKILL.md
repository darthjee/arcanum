---
name: auto-monitor-issue-pr
description: Resolves the PR for an issue's currently checked-out branch, then runs one bounded merge/close/approval/new-owner-comment check per invocation, rescheduling itself via ScheduleWakeup until one of those occurs. Used by auto-fix-all. Usage: /auto-monitor-issue-pr <id>
---

You are the coordinator. This skill now performs a single bounded check per invocation instead of blocking, so there is nothing left worth delegating to a spawned `architect` agent — run the check directly at this layer.

## Step 1 — Resolve REPO_PATH and parse arguments

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd — resolved fresh on every invocation, including each `ScheduleWakeup` re-entry below.

The raw skill argument is `<id>` (the issue id, accepted with or without a leading `#`).

## Step 2 — Run one bounded check

Read [steps/run.md](steps/run.md) (resolved relative to this skill folder) and follow it directly for `<id>`, carrying `REPO_PATH` forward — do not spawn `Agent(architect)` for this. It resolves the PR number for the issue's branch, then runs `auto-monitor-pr`'s single check once, reporting either `pending` or a terminal outcome (`merged`/`closed`/`approved`, or `commented` followed by one `---`-separated block per new comment) verbatim.

## Step 3 — React to the result

- **`pending`**: nothing terminal happened this pass. Call `ScheduleWakeup(delaySeconds=300, prompt="/auto-monitor-issue-pr <id>", reason="waiting for PR to reach a terminal state")` and stop. (Requires `auto-monitor-issue-pr` to have been invoked via `/loop /auto-monitor-issue-pr <id>` for the wakeup to actually fire — flag this clearly instead of silently doing nothing if it wasn't.)
- **Terminal outcome** (`merged`/`closed`/`approved`/`commented`): report it to the caller verbatim — do not summarize, reinterpret, or decide what to do about any comment it reports.
