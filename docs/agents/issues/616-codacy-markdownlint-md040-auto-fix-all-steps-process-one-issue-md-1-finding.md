# Issue: Codacy: markdownlint MD040 — auto-fix-all/steps/process_one_issue.md (1 finding)

## Description
markdownlint MD040 flags fenced code blocks that have no language tag. Without one, renderers can't highlight the block, and readers (and agents) can't tell at a glance whether it is shell, Markdown, JSON or plain output. Severity Info.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD040`, category CodeStyle, severity **Info**. Snapshot from the Codacy API on 2026-09-24 (commit `5107a41`), part of a batch of about 30 issues covering the worst open Codacy findings.

## Problem
Codacy reports one finding:

- `auto-fix-all/steps/process_one_issue.md:11`: Fenced code blocks should have a language specified

The file's opening section lists the possible `OUTCOME=` lines in four fenced blocks. Only the first one (lines 5–7) has a tag (`text`). The blocks that open at lines 11, 17 and 23 have no tag. Codacy flagged only line 11, but lines 17 and 23 break the same rule.

## Expected Behavior
- Codacy reports zero `markdownlint_MD040` findings for `auto-fix-all/steps/process_one_issue.md`.
- Every fenced code block in the file has a language tag.
- `.markdownlint.json` and `.markdownlintignore` are not changed, and the rendered Markdown looks the same.

## Solution
Add `text` to the opening fences at lines 11, 17 and 23 of `auto-fix-all/steps/process_one_issue.md`, so they match the existing `text` block at line 5. These blocks are literal output lines, not shell. Change nothing else.

Owner: `skill-writer` agent (skill step file).
