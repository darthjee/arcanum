# Add justification clauses to the 4 rules staying absolute

For lines 14, 37, 38, and 39, append a short justification clause explaining why no exception exists, without changing the rule's meaning:

- **Line 14**: append `— an inlined absolute path breaks silently once a script or its caller moves, with nothing to catch it.`
- **Line 37**: append `— bypassing the owning specialist causes scope drift and uncoordinated edits; route through` `architect` `instead.`
- **Line 38**: append `— a` `cd` `anywhere downstream (including inside a spawned subagent) could silently redirect mutations to the wrong repo.`
- **Line 39**: append `— this prevents concurrent-writer corruption of shared state.`

## Files to Change

- `AGENTS.md` — append the justification clauses above to lines 14, 37, 38, and 39.
