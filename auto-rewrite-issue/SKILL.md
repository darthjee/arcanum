---
name: auto-rewrite-issue
description: Autonomously drains the monitor-issues rewrite queue, rewriting each queued GitHub issue's body (no user interaction) and removing its pencil2 tag once pushed. Usage: /auto-rewrite-issue
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-rewrite-issue` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report to the user verbatim — do not summarize or reinterpret it.
