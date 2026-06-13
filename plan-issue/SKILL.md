---
name: plan-issue
description: Creates a implementation plan for a given issue. Reads the issue file, analyzes the codebase, asks clarifying questions, and writes a structured plan in the plans folder. Usage: /plan-issue 99 or /plan-issue #99
---

You are helping the user create an implementation plan for an existing issue. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Define the issue and plan files

Read [steps/file_definition.md](steps/file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and determine the plan location.

## Step 2 — Identify the project folder

Read [steps/identify_project_folder.md](steps/identify_project_folder.md) and follow the instructions there to determine which folder(s) or module(s) of the project this issue involves.

## Step 3 — Write and confirm the plan

Read [steps/write_and_confirm.md](steps/write_and_confirm.md) and follow the instructions there.
