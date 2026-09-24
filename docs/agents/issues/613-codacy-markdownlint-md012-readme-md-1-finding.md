# Issue: Codacy: markdownlint MD012 — README.md (1 finding)

## Description
markdownlint MD012 (no multiple consecutive blank lines) flags one double blank line in `README.md`. Codacy rates it Info severity.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD012`, category CodeStyle, severity **Info**.

**Finding:**

- `README.md:9`: Expected: 1; Actual: 2

## Problem
`README.md` lines 8 and 9 are both blank. They sit between the badge block (lines 5–7) and the `arcanum.png` image (line 10), which breaks MD012.

## Expected Behavior
- Codacy reports zero `markdownlint_MD012` findings for `README.md`.
- `.markdownlint.json` / `.markdownlintignore` are unchanged.
- The rendered README looks the same.
- Only `README.md` is touched.

## Solution
Delete one of the two blank lines between the badge block and the `arcanum.png` image, so exactly one blank line separates them.
