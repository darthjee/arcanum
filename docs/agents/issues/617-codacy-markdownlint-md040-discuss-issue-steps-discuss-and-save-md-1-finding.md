# Issue: Codacy: markdownlint MD040 — discuss-issue/steps/discuss_and_save.md (1 finding)

## Description
Codacy (markdownlint, pattern `markdownlint_MD040`, category CodeStyle, severity Info) reports one fenced code block without a language tag:

- `discuss-issue/steps/discuss_and_save.md:82`: Fenced code blocks should have a language specified

## Problem
The flagged fence wraps the literal prompt `Would you like me to start planning this issue now?` in step 8 (Planning confirmation). Without an info string, renderers can't highlight it and readers can't tell at a glance what kind of content it is. The equivalent prompt in step 7 (`Did I comprehend the issue?`, line 52) already uses `` ```text ``, so the file is also internally inconsistent.

## Expected Behavior
- Codacy reports zero `markdownlint_MD040` findings for `discuss-issue/steps/discuss_and_save.md`.
- `.markdownlint.json` is left unchanged, and the rendered Markdown looks the same.

## Solution
Change the opening fence at `discuss-issue/steps/discuss_and_save.md:82` from `` ``` `` to `` ```text ``, matching the step 7 prompt. No other changes. Owner: `skill-writer` agent.
