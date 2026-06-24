---
name: auto-monitor-issue-pr
description: Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by auto-fix-all. Usage: /auto-monitor-issue-pr <id>
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-monitor-issue-pr` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report to the caller verbatim — do not summarize, reinterpret, or decide what to do about any comment it reports.
