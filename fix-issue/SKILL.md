---
name: fix-issue
description: Opens a PR to fix a given issue. Reads the issue and plan files, presents a summary, and opens a PR upon confirmation. Usage: /fix-issue 5, /fix-issue 05, /fix-issue #5, /fix-issue #05
---

You are helping the user open a pull request to fix an existing issue. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Select the base branch

Run `git branch --show-current` and use the current branch as the base branch. No confirmation needed.

## Step 2 — Locate the issue and plan files

Read [steps/file_definition.md](steps/file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and find the corresponding plan.

## Step 3 — Open the PR

Read [steps/open_pr.md](steps/open_pr.md) and follow the instructions there.
