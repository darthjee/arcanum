# Skill-Writer Plan: Codacy: markdownlint MD031 cluster — fenced code blocks not surrounded by blank lines (21 findings, 12 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — this file's fix is independent of `architect`'s work (see [plan.md](plan.md)).

## Implementation Steps

### Step 1 — Add blank lines around fenced code blocks in the 11 affected skill files

Sweep each file below and ensure every fenced code block has a blank line immediately before its opening fence and immediately after its closing fence, except where the block opens/closes the document. This rule is auto-fixable by `markdownlint --fix` — prefer running the formatter (scoped to these 11 files) and reviewing the diff over hand-editing, to avoid missing any of the flagged spots or introducing unrelated changes to the surrounding prose/scripts.

## Files to Change

- `auto-fix-all/SKILL.md` — add missing blank line(s) around fenced code block(s).
- `auto-fix-all/steps/handle_comment.md` — add missing blank line(s) around fenced code block(s).
- `auto-fix-all/steps/process_one_issue.md` — add missing blank line(s) around fenced code block(s).
- `auto-fix-issue/steps/dispatch_agents.md` — add missing blank line(s) around fenced code block(s).
- `auto-fix-issue/steps/open_pr.md` — add missing blank line(s) around fenced code block(s).
- `auto-new-issue/steps/write_issue.md` — add missing blank line(s) around fenced code block(s).
- `discuss-issue/steps/discuss_and_save.md` — add missing blank line(s) around fenced code block(s).
- `init-claude/sample-contributing.md` — add missing blank line(s) around fenced code block(s).
- `init-claude/setup_auto_fix_all_settings.md` — add missing blank line(s) around fenced code block(s).
- `init-claude/setup_labels.md` — add missing blank line(s) around fenced code block(s).
- `plan-issue/steps/write_and_confirm.md` — add missing blank line(s) around fenced code block(s).

No content changes inside any block — only surrounding blank lines.

## Notes

- Verify no MD031 findings remain in these 11 files afterward (re-run markdownlint/Codacy, or manually re-check each fence for surrounding blank lines).
