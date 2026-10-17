# README

Write `arcanum-next-step/README.md`:

- What the mod does and why (#790, #791), and that it is inert until a skill calls
  it (#798).
- The tool contract (from the shared contracts), with the **stability rule**: renaming
  the tool or changing its schema is breaking for the skills that call it; skills
  always reference it by its full name.
- The allowlist and why (no built-ins, no other plugins' commands).
- Optional per-call approval: an `ask` permission rule for
  `mcp__arcanum-next-step__handoff`.
- Opt-out: leave `next_step.clear.*` unset (durable); deleting the folder works but
  `/arcanum-update` re-adds it.
- Loading: auto-loads from a skills folder (user or project `.claude/skills/`); not
  from a custom path elsewhere; after `/arcanum-update` it loads in new sessions.
- Headless and double-install behavior, per what implementation verified.

## Files to Change
- `arcanum-next-step/README.md` — new.
