# Issue: Codacy: markdownlint MD060 — init-claude/setup_auto_fix_all_settings.md (1 finding)

## Description

markdownlint MD060 (table column style, configured as `compact` in `.markdownlint.json`) flags a table pipe missing its space in `init-claude/setup_auto_fix_all_settings.md`. Severity Info.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD060`, category CodeStyle, severity **Info**.

## Problem

The settings table (lines 21–25) uses a bare delimiter row with no spaces around the dashes:

- `init-claude/setup_auto_fix_all_settings.md:22`: Table pipe is missing space to the right for style "compact"

  ```markdown
  |---|---|---|---|
  ```

## Expected Behavior

- Codacy reports zero `markdownlint_MD060` findings for `init-claude/setup_auto_fix_all_settings.md`.
- `.markdownlint.json` rules stay unchanged, and the rendered Markdown looks the same.
- Scope is limited to this one file; similar delimiter rows in other `init-claude/` files are out of scope here.

## Solution

Reformat the flagged delimiter row to the `compact` style — `| --- | --- | --- | --- |` — and make sure the header and body rows of the same table also have exactly one space on each side of every cell (they already do). No content changes.
