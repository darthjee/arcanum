# Skill Writer Plan: Codacy: markdownlint MD060 — init-claude/sample-contributing.md (1 finding)

Main plan: [plan.md](plan.md)

## Overview

Codacy's markdownlint MD060 check (set to `compact` in `.markdownlint.json`) flags line 74 of `init-claude/sample-contributing.md`. That line is the delimiter row `|---|---|` of the Application / Entrypoint table. The fix is a one-line whitespace change to that row.

## Context

- `init-claude/sample-contributing.md` is the reference template that `init-claude/setup_contributing.md` reads when generating a project's CONTRIBUTING.md. It is an auxiliary skill file, so it falls in skill-writer's scope.
- The file has only one table (lines 73–76). Its header and body rows already put one space on each side of every cell. Only the delimiter row is off.
- #629 (`auto-fix-issue/steps/run.md`) was fixed the same way: `|---|---|---|` → `| --- | --- | --- |`.

## Implementation Steps

### Step 1 — Reformat the table delimiter row

In `init-claude/sample-contributing.md`, change line 74 from `|---|---|` to `| --- | --- |`. Leave the rest of the file alone.

## Files to Change

- `init-claude/sample-contributing.md` — line 74: set the table delimiter row to the compact style (`| --- | --- |`).

## Notes

- `.circleci/config.yml` has no markdownlint job, so no local CI command covers this change. It is verified by Codacy's analysis on the PR.
- Leave `.markdownlint.json`, `.markdownlintignore` and `.codacy.yml` as they are.
