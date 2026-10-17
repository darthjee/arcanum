# Skill-writer Plan: Handle CLEAR=true in skills at automatic next-step hops

Main plan: [plan.md](plan.md)

## Shared contracts

- Pointers link to `skill-finish.md#clearing` and refer to the tool only as
  `mcp__arcanum-next-step__handoff`; do not restate the three levels in step files.
- Relay lines: `AUTO_CLEAR=true` then `AUTO_NEXT=/loop /auto-resolve-issue <id>`
  (last), only on `CHAIN=yes` + `CLEAR=true`. The coordinator never prints either.
- discuss-issue first offer + `CLEAR=true`: bootstrap branch + commit issue, stay
  on `issue-<id>`, print the push-only success report, then hand off
  `/auto-plan-issue <id>` (top-level) per Clearing.

## Steps

- [01 — Pointers in the interactive offer steps](skill-writer/01-offer-step-pointers.md)
- [02 — discuss-issue first offer with CLEAR=true](skill-writer/02-discuss-issue-first-offer.md)
- [03 — auto-plan-issue AUTO_CLEAR relay](skill-writer/03-auto-plan-issue-relay.md)

## Notes

- The `> Resolve ... It prints ...` contract blockquote in each offer step lists
  the outputs; add "(followed by `CLEAR=true` when `next_step.clear.<skill>` is
  also `true`)" after `AUTO=true` there.
- skill-reviewer will check the changed step files; no new inline bash is added.
