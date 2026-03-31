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

## Step 2 — Parse the issue ID

The argument may be in one of these formats:
- `99` → ID is `99`
- `#99` → strip the `#`, ID is `99`

## Step 3 — Locate the issue file

List the files in the issues folder and find the one whose name starts with the given ID (e.g., `99_add_tables.md`). Read that file to understand the issue.

If no matching file is found, inform the user and stop.

## Step 4 — Analyze the codebase

Based on the issue description, explore the relevant parts of the codebase to understand:
- What code is affected or needs to be created
- Existing patterns, conventions, and structure
- Dependencies or constraints

## Step 5 — Determine the plan location

The plan folder name follows the same base name as the issue file (without the `.md` extension). For example:
- Issue file: `99_add_tables.md`
- Plan folder: `<plans_folder>/99_add_tables/`
- Main plan file: `<plans_folder>/99_add_tables/plan.md`

If the plan is complex, it may be split into multiple files inside the same folder (e.g., `plan.md`, `plan_api.md`, `plan_database.md`). Use your judgment based on the scope of the issue.

## Step 6 — Write the initial plan

Write the plan file(s) in English, regardless of the language used in the issue or by the user.

Model `plan.md` after this structure (adapt sections as needed):

```markdown
# Plan: <Issue Title>

## Overview
<Brief description of what this plan covers>

## Context
<Relevant background from the issue and codebase analysis>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why>

### Step 2 — <Name>
<Description of what to do and why>

...

## Files to Change
- `path/to/file.ext` — <what changes and why>

## Notes
- <Any caveats, risks, or follow-up considerations>
```

If splitting into multiple files, `plan.md` should serve as the index with links to the other files.

## Step 7 — Clarify open questions

After writing the initial plan, determine if there is anything unclear or ambiguous that the user must decide. If so, ask all questions at once in a numbered list. Wait for the user's answers, then update the plan file with the clarified information.

If everything is clear, skip this step.

## Step 8 — Present an overview

Present a high-level overview of the plan to the user. Include:
- A summary of what will be implemented
- The main steps or phases
- Any notable design decisions or trade-offs

End with:

```
Does this approach look correct? Any adjustments?
```

Wait for the user's confirmation or corrections. If the user requests changes, update the plan file and present the overview again. Repeat until the user confirms.
