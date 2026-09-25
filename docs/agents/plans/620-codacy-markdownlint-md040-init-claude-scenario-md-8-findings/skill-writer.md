# Skill-Writer Plan: Codacy: markdownlint MD040 — init-claude/scenario_*.md (8 findings)

Main plan: [plan.md](plan.md)

## Overview

Add `text` to every untagged opening fence in the `init-claude` scenario files. Nothing else changes.

## Context

Codacy reported 8 MD040 findings, one per scenario file. Seven more untagged fences follow the same pattern but weren't in the snapshot. The issue asks for all 15 to be fixed. Each untagged fence wraps literal text shown to the user: either the `Shall I proceed?` prompt or the `Done! …` completion message. The files already use `text` for this kind of block elsewhere (e.g. the Step 1 message at line 9).

## Implementation Steps

### Step 1 — Tag the untagged opening fences with `text`

In each file below, change the listed opening fence line from ``````` to ``````text`. Leave closing fences, fences that already have a tag, and all block content unchanged.

| File | Opening-fence lines |
| --- | --- |
| `init-claude/scenario_agents_claude.md` | 21, 68 |
| `init-claude/scenario_agents_copilot.md` | 21, 68 |
| `init-claude/scenario_agents_only.md` | 19, 48 |
| `init-claude/scenario_all_present.md` | 21, 69 |
| `init-claude/scenario_both_no_agents.md` | 21, 68 |
| `init-claude/scenario_claude_only.md` | 21, 54 |
| `init-claude/scenario_copilot_only.md` | 21, 54 |
| `init-claude/scenario_new.md` | 64 |

Line numbers match `main` at the time of planning. Check each one against the file before editing: an opening fence is one that starts a block, not one that closes it.

## Files to Change

- `init-claude/scenario_agents_claude.md`: tag 2 opening fences
- `init-claude/scenario_agents_copilot.md`: tag 2 opening fences
- `init-claude/scenario_agents_only.md`: tag 2 opening fences
- `init-claude/scenario_all_present.md`: tag 2 opening fences
- `init-claude/scenario_both_no_agents.md`: tag 2 opening fences
- `init-claude/scenario_claude_only.md`: tag 2 opening fences
- `init-claude/scenario_copilot_only.md`: tag 2 opening fences
- `init-claude/scenario_new.md`: tag 1 opening fence

## Notes

- To check locally, pair up the fences in each file (odd occurrences open a block, even ones close it) and confirm every opening fence has a tag. If `markdownlint-cli` is available, `npx markdownlint-cli init-claude/scenario_*.md` should report no MD040 findings.
- No CI job runs markdownlint. Codacy is the only check.
- `.markdownlint.json` must not change.
