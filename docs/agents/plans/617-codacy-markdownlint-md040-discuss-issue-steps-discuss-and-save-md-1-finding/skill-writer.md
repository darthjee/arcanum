# Skill-writer Plan: Codacy: markdownlint MD040 — discuss-issue/steps/discuss_and_save.md (1 finding)

Main plan: [plan.md](plan.md)

## Overview
Codacy flags `discuss-issue/steps/discuss_and_save.md:82` under markdownlint MD040, because its fenced code block has no language tag. The fix is a one-line change to that opening fence.

## Context
The fence at lines 82–84 wraps the literal step 8 prompt `Would you like me to start planning this issue now?`. The step 7 prompt (`Did I comprehend the issue?`, lines 52–54) already opens with `` ```text ``, so this change also makes the file consistent.

## Implementation Steps

### Step 1 — Tag the step 8 prompt fence as `text`
In `discuss-issue/steps/discuss_and_save.md`, change the opening fence on line 82 from `` ``` `` to `` ```text ``. Leave the closing fence, the prompt text, and everything else in the file unchanged. Do not modify `.markdownlint.json`.

## Files to Change
- `discuss-issue/steps/discuss_and_save.md` — add the `text` info string to the opening fence on line 82.

## Notes
- After the edit, `grep -n '^```$' discuss-issue/steps/discuss_and_save.md` should return exactly 5 lines, one closing fence for each of the file's 5 fenced blocks, which confirms every opening fence has a language.
- CI (`.circleci/config.yml`) has no markdownlint job. The check runs in Codacy only.
