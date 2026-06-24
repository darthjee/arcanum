# Plan: Deprecate new-issue skill

Issue: [57-deprecate-new-issue-skill.md](../issues/57-deprecate-new-issue-skill.md)

## Overview

Remove the `new-issue/` skill directory and all references to it in project documentation. The `discuss-issue` skill provides a richer interactive flow that supersedes `new-issue`. The unrelated `auto-new-issue` skill must not be touched.

## Context

The `new-issue` skill offered a simple interactive prompt ("Describe me the issue") to create issue files. The newer `discuss-issue` skill covers the same use case with a richer dialogue loop. Keeping both creates confusion about the canonical entry point for issue creation.

## Implementation Steps

### Step 1 — Remove the `new-issue/` directory

Delete the entire `new-issue/` folder from the repository root, including `SKILL.md`, all files under `steps/`, and all files under `scripts/`.

### Step 2 — Remove references in `README.md`

Remove the table row for `/new-issue` from the "Available skills" table in `README.md`.

### Step 3 — Remove references in `AGENTS.md` (if any)

Grep `AGENTS.md` for any mention of `new-issue` and remove those lines or paragraphs.

### Step 4 — Verify `discuss-issue` covers all use cases

Confirm that the `discuss-issue` skill folder exists and its `SKILL.md` describes creating and refining issues. No code changes needed here — this is a verification step only.

## Files to Change

- `new-issue/` — delete the entire directory
- `README.md` — remove the `/new-issue` table row
- `AGENTS.md` — remove any `new-issue` references (if present)

## Notes

- Do NOT remove or modify `auto-new-issue/` — it is part of the autonomous pipeline and is explicitly out of scope.
- The `discuss-issue` skill is already present and does not need to be modified.
