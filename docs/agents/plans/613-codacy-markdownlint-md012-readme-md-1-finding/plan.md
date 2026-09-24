# Plan: Codacy: markdownlint MD012 — README.md (1 finding)

Issue: [613-codacy-markdownlint-md012-readme-md-1-finding.md](../../issues/613-codacy-markdownlint-md012-readme-md-1-finding.md)

## Overview
Remove one of two consecutive blank lines in `README.md` to clear the single markdownlint MD012 finding reported by Codacy.

## Context
`README.md` lines 8 and 9 are both blank, between the badge block (lines 5–7) and the `arcanum.png` image (line 10). markdownlint MD012 expects at most one consecutive blank line.

## Implementation Steps

### Step 1 — Remove the extra blank line
Delete one of the two blank lines (line 8 or 9) so exactly one blank line separates the badge block from the `arcanum.png` image. Make no other edits to `README.md`. The rendered output is unchanged.

## Files to Change
- `README.md` — remove one blank line between the badges and the `arcanum.png` image.

## Notes
- Leave `.markdownlint.json` and `.markdownlintignore` as they are.
- No CI job runs markdownlint locally. Codacy re-checks the file after the push.
- `README.md` is a root-level file, so the architect owns it. No specialist agent is involved.
