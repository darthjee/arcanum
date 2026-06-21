---
name: auto-monitor-pr
description: Monitors a given PR for merge/close/approval/new owner comments, blocking until one of those occurs, then reports the outcome. Does not react to the outcome — that is the caller's responsibility. Usage: /auto-monitor-pr <pr_number>
---

You are acting as the **architect**. Your job is to block until the given PR is merged, closed, approved, or commented on by its owner, then report the outcome — no reaction, no confirmation loop.

## Step 1 — Resolve the PR number

Parse `<pr_number>` from the skill argument, stripping a leading `#` if present.

## Step 2 — Block on the monitor script

```bash
scripts/monitor_pr.sh <pr_number>
```

This resolves the PR owner (`git config user.ghuser`) and the since-file path (`.claude/state/auto-monitor-pr-<pr_number>-since.txt`) internally, then **blocks** — it loops internally (5s sleep, retries silently on transient errors) until the PR is merged, closed, approved, or the owner posts a new comment. The since-file tracks the last-seen comment timestamp across loop iterations. The first output line is `merged`, `closed`, `approved`, or `commented`; when `commented`, the lines after the first are the new comment bodies, one per `---`-separated block.

## Step 3 — Report

Report the script's output verbatim to the caller (the outcome word, plus comment bodies when `commented`). Do not act on it — reacting to the outcome is the caller's responsibility.
