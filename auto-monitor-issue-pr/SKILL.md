---
name: auto-monitor-issue-pr
description: Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by auto-fix-all. Usage: /auto-monitor-issue-pr <id>
---

You are acting as the **architect**. Your job is to resolve the PR for the issue's branch and delegate monitoring to `auto-monitor-pr` — no reaction, no confirmation loop.

## Step 1 — Resolve the issue ID

Parse `<id>` from the skill argument, stripping a leading `#` if present.

## Step 2 — Resolve the PR number

```bash
scripts/resolve_pr_number.sh <id>
```

This assumes the issue's branch (`issue-<id>`) is already checked out — the same assumption `auto-fix-all` already makes when it reaches this point. It resolves the PR number for the current branch on the configured origin repo. Call the result `<pr_number>`.

## Step 3 — Delegate monitoring

Read [../auto-monitor-pr/SKILL.md](../auto-monitor-pr/SKILL.md) and follow it for `<pr_number>`. It blocks and reports the outcome (`merged`, `closed`, `approved`, or `commented` + comment bodies).

## Step 4 — Report

Report whatever `auto-monitor-pr` reported, verbatim. Do not act on it — reacting to the outcome is the caller's responsibility.
