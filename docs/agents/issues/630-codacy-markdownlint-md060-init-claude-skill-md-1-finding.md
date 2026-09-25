# Issue: Codacy: markdownlint MD060 — init-claude/SKILL.md (1 finding)

## Description

markdownlint MD060 (table column style, configured as `compact` in `.markdownlint.json`) flags the delimiter row of the scenario-selection table in `init-claude/SKILL.md` (Step 3) because its pipes have no surrounding spaces. Severity Info.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD060`, category CodeStyle, severity **Info**. Codacy API snapshot taken on 2026-09-24 (commit `0a6c426`), one of a batch of about 30 issues covering the worst open Codacy findings.

### Findings

- `init-claude/SKILL.md:27`: Table pipe is missing space to the right for style "compact"

  ```markdown
  |---|---|---|---|
  ```

Only the delimiter row is affected: the header row and all 8 data rows (lines 26, 28–35) already use `| cell |` spacing.

## Problem

The delimiter row `|---|---|---|---|` does not match the repo's configured `compact` table style, so Codacy keeps reporting a CodeStyle finding on `init-claude/SKILL.md`.

## Expected Behavior

- Codacy reports zero `markdownlint_MD060` findings for `init-claude/SKILL.md`.
- `.markdownlint.json` stays unchanged, and the table renders exactly as before (same columns, rows, and links).

## Solution

Replace line 27 of `init-claude/SKILL.md`:

```markdown
|---|---|---|---|
```

with the compact-style delimiter row:

```markdown
| --- | --- | --- | --- |
```

No other lines change. This mirrors the fix applied for #629 (`auto-fix-issue/steps/run.md`). The file is a skill file, so the change is owned by the `skill-writer` agent.

## Benefits

- Clears one Codacy CodeStyle finding and keeps table formatting consistent with the rest of the repo.
