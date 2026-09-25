# Skill-writer Plan: Codacy: markdownlint MD040 — auto-fix-all/steps/process_one_issue.md (1 finding)

Main plan: [plan.md](plan.md)

## Overview
Add the `text` language tag to the three untagged opening code fences in `auto-fix-all/steps/process_one_issue.md` so the file passes markdownlint MD040. Nothing else changes.

## Context
Codacy flags `auto-fix-all/steps/process_one_issue.md:11` for MD040 (fenced code blocks should have a language specified). The top of the file lists the possible `OUTCOME=` lines in four fenced blocks. The first (lines 5–7) is already tagged `text`. The blocks opening at lines 11, 17 and 23 have no tag. Codacy only reported line 11, but lines 17 and 23 break the same rule and are fixed here too, so they don't come back as new findings.

## Implementation Steps

### Step 1 — Tag the untagged fences
Add `text` right after the three backticks of the bare opening fences at lines 11, 17 and 23, matching the block at line 5. Leave the closing fences and the block contents unchanged. These blocks hold literal output lines, not shell, so `text` is the right tag.

## Files to Change
- `auto-fix-all/steps/process_one_issue.md` — add `text` to the opening fences at lines 11, 17 and 23.

## Notes
- No CI job runs markdownlint; Codacy does the check. To verify locally, run `grep -n '^```$' auto-fix-all/steps/process_one_issue.md`: it should list only closing fences.
- Do not change `.markdownlint.json` or `.markdownlintignore`.
