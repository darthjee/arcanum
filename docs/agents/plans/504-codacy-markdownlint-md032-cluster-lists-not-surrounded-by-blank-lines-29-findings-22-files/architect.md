# architect Plan: Codacy: markdownlint MD032 cluster — lists not surrounded by blank lines (29 findings, 22 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — independent of skill-writer's work.

## Implementation Steps

### Step 1 — Add blank lines around lists in root-level and architecture-doc files

For each file below, add a blank line immediately before and after every list that is missing one (a list directly abutting a heading, a paragraph, or another block with no blank line between them). Do not otherwise reflow or reword the surrounding text — this is a whitespace-only fix. `markdownlint --fix` (rule `MD032`) can apply this mechanically; review the diff afterward to confirm no content was altered:

- `ISSUE_TEMPLATE.md`
- `docs/agents/architecture/lock-system.md`
- `docs/agents/architecture/per-repo-migrations.md`
- `docs/agents/architecture/repo-path-threading.md`
- `docs/agents/architecture/script-preference.md`

## Files to Change

- `ISSUE_TEMPLATE.md` — add blank lines around 1 list.
- `docs/agents/architecture/lock-system.md` — add blank lines around 2 lists.
- `docs/agents/architecture/per-repo-migrations.md` — add blank lines around 1 list.
- `docs/agents/architecture/repo-path-threading.md` — add blank lines around 1 list.
- `docs/agents/architecture/script-preference.md` — add blank lines around 1 list.

## Notes

- After the edits, re-run `markdownlint` (or the Codacy CLI, if available locally) against these 5 files to confirm zero MD032 findings remain.
