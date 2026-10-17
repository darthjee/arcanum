# Mod Plan: Handle CLEAR=true in skills at automatic next-step hops

Main plan: [plan.md](plan.md)

## Shared contracts

The tool contract is unchanged (name, `{ command }` schema, results). Skills call
it per `docs/agents/architecture/skill-finish.md#clearing`.

## Implementation Steps

### Step 1 — Update the README status section

In `arcanum-next-step/README.md`, rename `## Status: inert until a skill calls it`
to say what calls it, and replace "Until #798 no skill calls it" with: skills call
it at automatic next-step hops where `next_step.clear.<skill>` is `true`
(enhance-issue, discuss-issue's two offers, plan-issue, and the `auto-plan-issue`
coordinator), per the Clearing subsection (link it). Keep the fallback sentence
(`ScheduleWakeup` + asking the user to type `/clear`). Fix any in-README links to
the renamed heading.

## Files to Change

- `arcanum-next-step/README.md` — status section.

## Notes

- No code change: `register.ts`, tests and the tool contract stay as they are.
