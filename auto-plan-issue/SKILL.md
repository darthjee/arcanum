---
name: auto-plan-issue
description: Autonomously creates an implementation plan for an existing issue, without asking the user anything. Explores the codebase freely, splits the plan across specialist agents when the target project defines any in .claude/agents/, and commits the result. Usage: /auto-plan-issue <id> or /auto-plan-issue #<id>
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-plan-issue` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report to the user verbatim — do not summarize or reinterpret it.
