---
name: auto-new-issue
description: Autonomously creates a new issue file in the project's issues folder, without asking the user anything. Parses an optional ID and title, infers a structured description (pre-populating from GitHub when a numeric ID is given), saves the file, commits it, and syncs it to GitHub. Usage: /auto-new-issue #19 - Title or /auto-new-issue Title
---

You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `auto-new-issue` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

Wait for the agent to finish, then relay its final report to the user verbatim — do not summarize or reinterpret it.
