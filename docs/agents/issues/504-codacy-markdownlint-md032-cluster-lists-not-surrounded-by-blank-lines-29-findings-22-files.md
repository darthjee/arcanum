# Issue: Codacy: markdownlint MD032 cluster — lists not surrounded by blank lines (29 findings, 22 files)

## Description

Codacy's markdownlint flags 29 findings (22 files) where a list isn't surrounded by blank lines both before and after, which some Markdown parsers (e.g. kramdown) fail to parse correctly.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool markdownlint (`markdownlint_MD032` — blanks-around-lists).

**Affected files (count in parentheses):** `ISSUE_TEMPLATE.md` (1), `arcanum-split-issue/steps/push.md` (1), `auto-fix-all/SKILL.md` (2), `auto-fix-issue/steps/dispatch_agents.md` (1), `auto-plan-issue/steps/determine_agents.md` (1), `auto-plan-issue/steps/explore_codebase.md` (1), `auto-plan-issue/steps/write_plan.md` (1), `docs/agents/architecture/lock-system.md` (2), `docs/agents/architecture/per-repo-migrations.md` (1), `docs/agents/architecture/repo-path-threading.md` (1), `docs/agents/architecture/script-preference.md` (1), `init-claude/SKILL.md` (1), `init-claude/sample-contributing.md` (1), `init-claude/scenario_agents_claude.md` (2), `init-claude/scenario_agents_copilot.md` (2), `init-claude/scenario_all_present.md` (2), `init-claude/scenario_both_no_agents.md` (2), `init-claude/setup_agents.md` (1), `init-claude/setup_docs_structure.md` (1), `init-claude/setup_labels.md` (1), `plan-issue/steps/identify_project_folder.md` (1), `plan-issue/steps/write_and_confirm.md` (2).

## Expected Behavior

- Every list in the listed files has a blank line immediately before and after it (except at the very start/end of a document).
- Re-running markdownlint/Codacy shows zero MD032 findings among these 22 files.

## Solution

Sweep the 22 files adding blank lines around lists; this rule is auto-fixable by `markdownlint --fix`, so running the formatter across these files (then a quick diff review) is likely faster than hand-editing each one.
