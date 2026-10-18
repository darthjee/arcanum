# Document the unattended-loop variant in Clearing

Add a note to the `#### Clearing` subsection's `Notes:` list in `skill-finish.md`,
so `auto-fix-all` and `monitor-issues` can link to one source of truth instead of
restating the mod contract.

The note says:

- **Unattended `/loop` skills (`auto-fix-all`, `monitor-issues`)** use the same
  level 1 when their `clear_context` toggle is on. They hand off
  `/loop /auto-fix-all` or `/loop /monitor-issues`, the same command their wakeup
  used, wrapped in `/loop`. They skip level 2, because nobody may be there to type
  `/clear`. Their fallback replaces level 3: print `clear skipped: <reason>`, then
  the existing 60-second `ScheduleWakeup` re-entry, which restarts the skill
  without freeing context.
- These are not next-step hops. They are driven by the skill's own `clear_context`
  key, not by `next_step.clear.*`/`CLEAR=true`.

## Files to Change

- `docs/agents/architecture/skill-finish.md` — add the note above under
  `#### Clearing` → `Notes:`.
