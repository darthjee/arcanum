---
name: plan-issue
description: Creates an implementation plan for a given issue. Reads the issue file, analyzes the codebase, asks clarifying questions, and writes a structured plan in the plans folder; once confirmed, commits and pushes the plan, marks the issue Ready, prints a closing report, and offers /auto-resolve-issue as the next step. Usage: /plan-issue 99 or /plan-issue #99
---

You are helping the user create an implementation plan for an existing issue. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to every script call in the steps below that resolves the GitHub repo or performs a git operation (including bare `git` commands issued directly in step prose).

## Step 1 — Define the issue and plan files

Read [steps/file_definition.md](steps/file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and determine the plan location.

## Step 2 — Identify the project folder

Read [steps/identify_project_folder.md](steps/identify_project_folder.md) and follow the instructions there to determine which folder(s) or module(s) of the project this issue involves.

## Step 3 — Write, confirm and commit the plan

Read [steps/write_and_confirm.md](steps/write_and_confirm.md) and follow the instructions there: once the user confirms the plan, it is committed and pushed on `issue-<id>` and the issue is marked `Ready`; the skill then ends with the standard closing report and, on success, the `/auto-resolve-issue <id>` offer.
