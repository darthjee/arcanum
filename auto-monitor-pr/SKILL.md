---
name: auto-monitor-pr
description: Monitors a given PR for merge/close/approval/new owner comments, blocking until one of those occurs, then reports the outcome. Tracks each owner comment's open/addressed lifecycle with :eyes:/:+1: reactions on the comment itself, but leaves deciding how to address a comment to the caller. Usage: /auto-monitor-pr <pr_number>
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-monitor-pr` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report to the caller verbatim — do not summarize, reinterpret, or decide what to do about any comment it reports.
