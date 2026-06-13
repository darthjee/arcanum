---
name: new-issue
description: Creates a new issue file in the project's issues folder. Parses an optional ID and title, prompts for a description interactively, and saves a structured markdown issue file. Usage: /new-issue #19 - Title or /new-issue Title
---

You are helping the user create a new issue file for the current project. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

## Step 1 — Define the issue ID and filename

Read [steps/file_definition.md](steps/file_definition.md) and follow the instructions there to parse the arguments, auto-assign an ID if needed, and build the filename.

## Step 2 — Collect description and save

Read [steps/collect_and_save.md](steps/collect_and_save.md) and follow the instructions there.
