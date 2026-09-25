# Issue: Codacy: markdownlint MD040 — init-claude/scenario_*.md (8 findings)

## Description

markdownlint MD040 flags fenced code blocks that have no language tag. Without a tag, renderers can't highlight the block, and readers (and agents) can't tell at a glance whether it holds shell, Markdown, JSON, or plain text. The `init-claude` scenario files are built the same way, so the same untagged fences show up in each one.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD040`, category CodeStyle, severity **Info**.

### Findings reported by Codacy

- `init-claude/scenario_agents_claude.md:21`
- `init-claude/scenario_agents_copilot.md:21`
- `init-claude/scenario_agents_only.md:19`
- `init-claude/scenario_all_present.md:21`
- `init-claude/scenario_both_no_agents.md:21`
- `init-claude/scenario_claude_only.md:21`
- `init-claude/scenario_copilot_only.md:21`
- `init-claude/scenario_new.md:64`

### Additional untagged fences, same pattern and not in the snapshot

- `init-claude/scenario_agents_claude.md:68`
- `init-claude/scenario_agents_copilot.md:68`
- `init-claude/scenario_agents_only.md:48`
- `init-claude/scenario_all_present.md:69`
- `init-claude/scenario_both_no_agents.md:68`
- `init-claude/scenario_claude_only.md:54`
- `init-claude/scenario_copilot_only.md:54`

## Problem

Some opening fences have no info string. They wrap either the `Shall I proceed?` confirmation prompt or the `Done! …` completion message shown to the user. Every other fence in these files already carries `text` or `markdown`.

## Expected Behavior

- None of the 8 `init-claude/scenario_*.md` files has an untagged opening fence, so Codacy reports zero `markdownlint_MD040` findings for them.
- `.markdownlint.json` is unchanged, and the rendered Markdown looks the same apart from the language tags.

## Solution

Add `text` to each of the 15 untagged opening fences listed above. The fences hold literal prompt or message text, which matches the `text` convention already used for the Step 1 message block in these files. Closing fences stay as they are. No other content changes.

Owner: `skill-writer` agent, since these are skill step files.

## Benefits

- Clears the Codacy findings and prevents the 7 unlisted fences from appearing in a later snapshot.
- Keeps fence tagging consistent across all `init-claude` scenarios.
