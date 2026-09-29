---
name: auto-rewrite-issue
description: Autonomously drains the monitor-issues rewrite queue, rewriting each queued GitHub issue's body (no user interaction) and removing its created tag once pushed. Usage: /auto-rewrite-issue
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd — before spawning.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-rewrite-issue` skill folder) and follow it. ARGUMENTS: `<raw skill arguments>` REPO_PATH: `<resolved_path>`")

Wait for the agent to finish, then relay its closing report (the `finish_report.sh` block) to the user verbatim as your last output — do not summarize, reinterpret, or add anything to it.
