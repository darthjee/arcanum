# skill-writer Plan: Codacy: markdownlint MD032 cluster — lists not surrounded by blank lines (29 findings, 22 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — independent of architect's work.

## Implementation Steps

### Step 1 — Add blank lines around lists in the 17 flagged skill files

For each file below, add a blank line immediately before and after every list that is missing one (a list directly abutting a heading, a paragraph, or another block with no blank line between them). Do not otherwise reflow or reword the surrounding text — this is a whitespace-only fix. `markdownlint --fix` (rule `MD032`) can apply this mechanically; review the diff afterward to confirm no content was altered:

- `arcanum-split-issue/steps/push.md`
- `auto-fix-all/SKILL.md`
- `auto-fix-issue/steps/dispatch_agents.md`
- `auto-plan-issue/steps/determine_agents.md`
- `auto-plan-issue/steps/explore_codebase.md`
- `auto-plan-issue/steps/write_plan.md`
- `init-claude/SKILL.md`
- `init-claude/sample-contributing.md`
- `init-claude/scenario_agents_claude.md`
- `init-claude/scenario_agents_copilot.md`
- `init-claude/scenario_all_present.md`
- `init-claude/scenario_both_no_agents.md`
- `init-claude/setup_agents.md`
- `init-claude/setup_docs_structure.md`
- `init-claude/setup_labels.md`
- `plan-issue/steps/identify_project_folder.md`
- `plan-issue/steps/write_and_confirm.md`

## Files to Change

- `arcanum-split-issue/steps/push.md` — add blank lines around 1 list.
- `auto-fix-all/SKILL.md` — add blank lines around 2 lists.
- `auto-fix-issue/steps/dispatch_agents.md` — add blank lines around 1 list.
- `auto-plan-issue/steps/determine_agents.md` — add blank lines around 1 list.
- `auto-plan-issue/steps/explore_codebase.md` — add blank lines around 1 list.
- `auto-plan-issue/steps/write_plan.md` — add blank lines around 1 list.
- `init-claude/SKILL.md` — add blank lines around 1 list.
- `init-claude/sample-contributing.md` — add blank lines around 1 list.
- `init-claude/scenario_agents_claude.md` — add blank lines around 2 lists.
- `init-claude/scenario_agents_copilot.md` — add blank lines around 2 lists.
- `init-claude/scenario_all_present.md` — add blank lines around 2 lists.
- `init-claude/scenario_both_no_agents.md` — add blank lines around 2 lists.
- `init-claude/setup_agents.md` — add blank lines around 1 list.
- `init-claude/setup_docs_structure.md` — add blank lines around 1 list.
- `init-claude/setup_labels.md` — add blank lines around 1 list.
- `plan-issue/steps/identify_project_folder.md` — add blank lines around 1 list.
- `plan-issue/steps/write_and_confirm.md` — add blank lines around 2 lists.

## Notes

- After the edits, re-run `markdownlint` (or the Codacy CLI, if available locally) against these 17 files to confirm zero MD032 findings remain.
