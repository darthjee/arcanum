# Plan: Codacy: markdownlint MD060 — init-claude/SKILL.md (1 finding)

Issue: [630-codacy-markdownlint-md060-init-claude-skill-md-1-finding.md](../../issues/630-codacy-markdownlint-md060-init-claude-skill-md-1-finding.md)

## Overview

Fix the single markdownlint MD060 finding in `init-claude/SKILL.md` by giving the table's delimiter row the `compact` spacing configured in `.markdownlint.json`.

## Context

Codacy flags `init-claude/SKILL.md:27` (`|---|---|---|---|`) with "Table pipe is missing space to the right for style \"compact\"". The table's header row (line 26) and all 8 data rows (lines 28–35) already use `| cell |` spacing, so only the delimiter row needs to change. The same fix was applied to `auto-fix-issue/steps/run.md` for #629.

## Implementation Steps

### Step 1 — Reformat the delimiter row

In `init-claude/SKILL.md`, replace line 27:

```markdown
|---|---|---|---|
```

with:

```markdown
| --- | --- | --- | --- |
```

Leave every other line unchanged. The table has 4 columns, so the delimiter row needs exactly 4 `---` cells.

## Files to Change

- `init-claude/SKILL.md` — reformat the Step 3 table's delimiter row (line 27) to compact style.

## Notes

- `.markdownlint.json` must not change.
- The rendered table stays identical; this is only a whitespace change in the source.
- No CI job runs markdownlint, so verification is by inspection (and Codacy after merge).
