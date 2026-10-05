---
name: auto-plan-issue
description: Autonomously creates an implementation plan for an existing issue, without asking the user anything. Explores the codebase freely, splits the plan across specialist agents when the target project defines any in .claude/agents/, and commits the result. Usage: /auto-plan-issue <id> or /auto-plan-issue #<id>
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd — before spawning.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-plan-issue` skill folder) and follow it. ARGUMENTS: `<raw skill arguments>` REPO_PATH: `<resolved_path>`")

Wait for the agent to finish, then relay its final report to the user verbatim — do not summarize or reinterpret it.

If the report's last line is `AUTO_NEXT=<cmd>` (only a top-level run whose `next_step.auto.auto-plan-issue` is `true` prints it; see the Auto-next section of steps/run.md), relay everything above that line, but not the line itself. Then invoke `<cmd>` (always `/loop /auto-resolve-issue <id>`) inline, in the same session, through the `loop` skill (`Skill(loop, "/auto-resolve-issue <id>")`), as a **chained** top-level run — no `NESTED=true`. It prints its own report.
