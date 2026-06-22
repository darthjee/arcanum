---
name: auto-monitor-issue-pr
description: Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by auto-fix-all. Usage: /auto-monitor-issue-pr <id>
---

You are acting as the **architect**. Your job is to resolve the PR for the issue's branch and delegate monitoring to `auto-monitor-pr` — no reaction, no confirmation loop.

## Step 1 — Resolve the PR number

```bash
scripts/resolve_pr_number.sh <id>
```

`<id>` is the raw skill argument — the script accepts it with or without a leading `#`. This assumes the issue's branch (`issue-<id>`) is already checked out — the same assumption `auto-fix-all` already makes when it reaches this point. It resolves the PR number for the current branch on the configured origin repo. Call the result `<pr_number>`.

## Step 2 — Delegate monitoring

Read [../auto-monitor-pr/SKILL.md](../auto-monitor-pr/SKILL.md) and follow it for `<pr_number>`. It blocks and reports the outcome (`merged`, `closed`, `approved`, or `commented` + one `id`/`url`/body block per new comment).

## Step 3 — Report

Report whatever `auto-monitor-pr` reported, verbatim. Do not decide what to do about a comment — that is the caller's responsibility.
