# Plan: Codacy: markdownlint MD060 — init-claude/setup_auto_fix_all_settings.md (1 finding)

Issue: [632-codacy-markdownlint-md060-init-claude-setup-auto-fix-all-settings-md-1-finding.md](../../issues/632-codacy-markdownlint-md060-init-claude-setup-auto-fix-all-settings-md-1-finding.md)

## Overview

Fix the single Codacy `markdownlint_MD060` finding in `init-claude/setup_auto_fix_all_settings.md` by giving the settings table's delimiter row the `compact` spacing.

## Context

`.markdownlint.json` configures MD060 (table column style) as `compact`: exactly one space on each side of every cell, including the delimiter row. The settings table at lines 21–25 has a bare delimiter row (`|---|---|---|---|`, line 22). Its header and body rows already use single-space padding.

## Implementation Steps

### Step 1 — Reformat the delimiter row

In `init-claude/setup_auto_fix_all_settings.md`, replace line 22:

```markdown
|---|---|---|---|
```

with:

```markdown
| --- | --- | --- | --- |
```

Leave the header row, body rows, and all other content unchanged.

## Files to Change

- `init-claude/setup_auto_fix_all_settings.md` — line 22: add a single space on each side of every delimiter cell (MD060 `compact`).

## Notes

- Only the flagged file is in scope. Other `init-claude/` files with the same bare delimiter style (`setup_agents.md:104`, `setup_folder_structure.md:30`/`:37`, and `scripts/setup_docs_structure_shell.sh:94`) are not changed here.
- This matches the fix already merged for issue #630 (`init-claude/SKILL.md`).
- No CI job runs markdownlint; the finding is verified through Codacy after merge.
