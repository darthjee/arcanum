---
name: auto-fix-issue
description: Autonomously implements a planned issue with no user interaction. Discovers the specialist agents involved in the plan, dispatches them in parallel, reviews and re-dispatches until correct, then opens or marks ready a pull request. Usage: /auto-fix-issue <id> or /auto-fix-issue #<id>
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-fix-issue` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report (including the PR URL) to the user verbatim — do not summarize or reinterpret it.
