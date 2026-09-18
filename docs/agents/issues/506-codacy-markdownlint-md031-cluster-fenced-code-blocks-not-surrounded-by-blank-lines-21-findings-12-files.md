## Description

Codacy's markdownlint flags 21 findings (12 files) where a fenced code block isn't surrounded by blank lines both before and after, which some parsers (e.g. kramdown) fail to parse correctly.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool markdownlint (`markdownlint_MD031` — blanks-around-fences).

## Affected files (count in parentheses)

`auto-fix-all/SKILL.md` (2), `auto-fix-all/steps/handle_comment.md` (2), `auto-fix-all/steps/process_one_issue.md` (2), `auto-fix-issue/steps/dispatch_agents.md` (2), `auto-fix-issue/steps/open_pr.md` (2), `auto-new-issue/steps/write_issue.md` (1), `discuss-issue/steps/discuss_and_save.md` (2), `docs/guides/arcanum-global-config.md` (1), `init-claude/sample-contributing.md` (2), `init-claude/setup_auto_fix_all_settings.md` (2), `init-claude/setup_labels.md` (1), `plan-issue/steps/write_and_confirm.md` (2).

## Expected Behavior

- Every fenced code block in the listed files has a blank line immediately before and after it (except where the block opens/closes the document).
- Re-running markdownlint/Codacy shows zero MD031 findings among these 12 files.

## Solution

Sweep the 12 files adding blank lines around fenced code blocks; this rule is auto-fixable by `markdownlint --fix`, so run the formatter and review the diff rather than hand-editing.

