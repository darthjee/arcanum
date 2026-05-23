---
name: fix-issue
description: Opens a PR to fix a given issue. Reads the issue and plan files, presents a summary, and opens a PR upon confirmation. Usage: /fix-issue 5, /fix-issue 05, /fix-issue #5, /fix-issue #05
---

You are helping the user open a pull request to fix an existing issue. Follow the steps below precisely and in order.

## Step 1 — Select the base branch

Read [steps/base_branch.md](steps/base_branch.md) and follow the instructions there to determine the base branch and switch to it if needed. If the user declines to switch branches, stop here.

## Step 2 — Find the issues and plans folders

Read `AGENTS.md` (and `CLAUDE.md` if needed) in the current working directory to locate:
- The **issues folder** (e.g., `docs/issues/`, `docs/agents/issues/`)
- The **plans folder** (e.g., `docs/plans/`, `docs/agents/plans/`)

Use whatever paths are documented there.

## Step 3 — Locate the issue and plan files

Read [steps/file_definition.md](steps/file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and find the corresponding plan.

## Step 4 — Open the PR

Read [steps/open_pr.md](steps/open_pr.md) and follow the instructions there.
