# Remove the temporary drift rule from scripter and skill-reviewer

- `.claude/agents/scripter.md`: delete the "Temporary: docker migration checklist (epic #724)" section (around line 30).
- `.claude/agents/skill-reviewer.md`: delete the "Temporary: docker migration checklist (epic #724)" section (around line 24) and the matching rejection reason, `Reason: script added/removed without updating docs/agents/specs/docker/checklist.md (epic #724)` (around line 51), including any example block that exists only for it.
- Check `scripter.md` line 24's native-only paragraph still reads correctly without the removed section.

## Files to Change
- `.claude/agents/scripter.md` — remove the temporary section.
- `.claude/agents/skill-reviewer.md` — remove the temporary section and its rejection reason.
