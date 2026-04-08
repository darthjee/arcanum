---
name: plan-issue
description: Creates a implementation plan for a given issue. Reads the issue file, analyzes the codebase, asks clarifying questions, and writes a structured plan in the plans folder. Usage: /plan-issue 99 or /plan-issue #99
---

You are helping the user create an implementation plan for an existing issue. Follow the steps below precisely and in order.

## Step 1 — Find the issues and plans folders

Read `AGENTS.md` (and `CLAUDE.md` if needed) in the current working directory to locate:
- The **issues folder** (e.g., `docs/issues/`, `docs/agents/issues/`)
- The **plans folder** (e.g., `docs/plans/`, `docs/agents/plans/`)

Use whatever paths are documented there.

## Step 2 — Define the issue and plan files

Read [file_definition.md](file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and determine the plan location.

## Step 3 — Identify the project folder

Read [identify_project_folder.md](identify_project_folder.md) and follow the instructions there to determine which folder(s) or module(s) of the project this issue involves, and confirm with the user.

## Step 4 — Write and confirm the plan

Read [write_and_confirm.md](write_and_confirm.md) and follow the instructions there.
