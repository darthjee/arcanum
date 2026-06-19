# Plan: Remove old skills

Issue: [8-remove-old-skills.md](../../issues/8-remove-old-skills.md)

## Overview

Delete the obsolete `check-plan/`, `fix-issue/`, and `new-plan/` skills, and update every other file that references them so nothing is left dangling.

## Context

- `check-plan/` (files: `SKILL.md`, `validate_and_refine.md`) validates an existing plan and, per its `SKILL.md`, optionally invokes `/fix-issue`.
- `fix-issue/` (files: `SKILL.md`, `steps/file_definition.md`, `steps/apply_plan.md`, `steps/open_pr.md`, `scripts/github.sh`) opens a PR for a planned issue.
- `new-plan/` (file: `SKILL.md`) creates an issue and its plan in one flow.
- Found by grepping the repo for these three skill names:
  - `README.md` lists all three in the skills table (lines ~20-22).
  - `docs/agents/folder-structure.md` lists all three (lines 11, 12, 15).
  - `plan-issue/steps/write_and_confirm.md:97` tells the user, after confirming a plan, to invoke `/fix-issue <id>` — this must be updated since that skill will no longer exist.
  - `.claude/agents/architect.md:11` uses `fix-issue/` as an example path in its scope description.
  - `check-plan/SKILL.md` itself references `/fix-issue` internally — irrelevant once `check-plan/` is deleted.
  - No `auto-*` skill references any of these three (confirmed: `auto-fix-issue`, `auto-plan-issue`, `auto-new-issue`, `auto-fix-all` are unrelated namesakes, not dependents).

## Implementation Steps

### Step 1 — Delete the skill folders

Remove `check-plan/`, `fix-issue/`, and `new-plan/` entirely (`git rm -r`).

### Step 2 — Update `README.md`

Remove the three table rows for `/check-plan`, `/new-plan`, and `/fix-issue`.

### Step 3 — Update `docs/agents/folder-structure.md`

Remove the three corresponding rows.

### Step 4 — Update `plan-issue/steps/write_and_confirm.md`

Replace the line `If the user confirms ...: invoke the \`/fix-issue <id>\` skill ...` with guidance pointing at `/auto-fix-issue <id>` instead (the autonomous equivalent that still exists), so the interactive `plan-issue` flow still has a natural next step.

### Step 5 — Update `.claude/agents/architect.md`

Replace the `fix-issue/` example in the scope-description bullet with a still-existing skill folder (e.g. `new-issue/`).

### Step 6 — Sweep for leftovers

Grep the repo again for `check-plan`, `new-plan`, and a standalone `fix-issue` (careful to exclude `auto-fix-issue` matches) to confirm nothing else references the removed skills.

## Files to Change

- `check-plan/` (deleted)
- `fix-issue/` (deleted)
- `new-plan/` (deleted)
- `README.md`
- `docs/agents/folder-structure.md`
- `plan-issue/steps/write_and_confirm.md`
- `.claude/agents/architect.md`

## Notes

- No CI config exists in this repo, so no `## CI Checks` section applies.
- This is pure markdown/file removal work; no agent split needed.
