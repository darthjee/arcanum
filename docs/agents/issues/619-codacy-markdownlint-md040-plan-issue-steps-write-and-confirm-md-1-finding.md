# Issue: Codacy: markdownlint MD040 — plan-issue/steps/write_and_confirm.md (1 finding)

## Description
markdownlint MD040 flags fenced code blocks that have no language tag. Without a tag, renderers can't highlight the block, and readers (and agents) can't tell at a glance whether it holds shell, Markdown, JSON or plain text. Severity Info.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD040`, category CodeStyle, severity **Info**.

## Problem
Finding:

- `plan-issue/steps/write_and_confirm.md:129`: Fenced code blocks should have a language specified. The fence wraps the literal prompt `Does this approach look correct? Anything to add or correct?` in step 4 of the confirmation loop.

The same file has a second fence with no language at line 137. It wraps the prompt `Would you like to proceed and open a PR to fix this issue now?` in "Offer to open the PR". The Codacy snapshot did not report it, but it breaks the same rule, so this issue fixes it too.

## Expected Behavior
- Codacy reports zero `markdownlint_MD040` findings for `plan-issue/steps/write_and_confirm.md`.
- `.markdownlint.json` rules stay unchanged, and the rendered Markdown looks the same.

## Solution
Add `text` as the info string on the opening fence at line 129 and on the one at line 137. Each block is a literal user-facing prompt, not code. This matches the fix used for #617 (`discuss-issue/steps/discuss_and_save.md`). Owner: `skill-writer` agent.
