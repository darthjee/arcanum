# auto-plan-issue AUTO_CLEAR relay

- `auto-plan-issue/steps/run.md`, Auto-next: in the `CHAIN=yes` bullet, when
  `auto_next.sh` also printed `CLEAR=true`, end the report with
  `AUTO_CLEAR=true` and then `AUTO_NEXT=/loop /auto-resolve-issue <id>`
  (`AUTO_NEXT=` stays last). Mention `CLEAR=true` in the `auto_next.sh`
  output description.
- `auto-plan-issue/SKILL.md`, coordinator: if the last line is `AUTO_NEXT=<cmd>`
  and the line before it is `AUTO_CLEAR=true`, relay everything above both lines
  (never either control line), then hand off `<cmd>` per
  [Clearing](../docs/agents/architecture/skill-finish.md#clearing) instead of
  `Skill(loop, …)`; level 3 is today's inline `Skill(loop, "/auto-resolve-issue <id>")`
  with the `clear skipped` notice. The coordinator never re-reads config.

## Files to Change
- `auto-plan-issue/steps/run.md` — AUTO_CLEAR line on CHAIN=yes + CLEAR=true.
- `auto-plan-issue/SKILL.md` — coordinator strips both lines, applies Clearing.
