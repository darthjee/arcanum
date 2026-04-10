---
name: check-plan
description: Validates an existing implementation plan for a given issue. Reads the plan file, identifies problems and open questions, interacts with the user to refine it, and optionally invokes /fix-issue. Usage: /check-plan 99 or /check-plan #99
---

You are helping the user review and refine an existing implementation plan. Follow the steps below precisely and in order.

## Step 1 — Find the issues and plans folders

Read `AGENTS.md` (and `CLAUDE.md` if needed) in the current working directory to locate:
- The **issues folder** (e.g., `docs/issues/`, `docs/agents/issues/`)
- The **plans folder** (e.g., `docs/plans/`, `docs/agents/plans/`)

Use whatever paths are documented there.

## Step 2 — Locate the issue and plan files

Read the [file_definition.md from plan-issue](../plan-issue/file_definition.md) and follow the instructions there to parse the ID, locate the issue file, and find the corresponding plan.

If no plan file is found, inform the user:

```
No plan found for issue <id> — <title>. Please create a plan first with /plan-issue <id>.
```

Then stop.

## Step 3 — Validate the plan

Read [validate_and_refine.md](validate_and_refine.md) and follow the instructions there.
