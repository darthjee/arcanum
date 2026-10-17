# Architect Plan: Handle CLEAR=true in skills at automatic next-step hops

Main plan: [plan.md](plan.md)

## Shared contracts

Owns the `#### Clearing` subsection (anchor `#clearing`) and the level/relay
contract in [plan.md](plan.md#shared-contracts); skill-writer's pointers link to it.

## Implementation Steps

### Step 1 — Clearing subsection and skill-side rules

In `docs/agents/architecture/skill-finish.md`:

- Add `#### Clearing` at the end of `### Auto-next`. It documents the ordering
  (finish work → closing report → auto-continuing notice → clear → next command),
  the three levels with their exact calls, notices and the mod error handling,
  that a mod-submitted prompt arrives labelled plugin-sent and is treated like a
  typed command, that a user interjection does not cancel a scheduled hop (next
  skills are idempotent: draft resume, "plan already exists", branch reuse), that
  a manual `[Y]es` never clears, and that nested runs never clear.
- It states the discuss-issue first-offer special case and the known Ready gap
  (see plan.md).
- Replace the `CLEAR=true` bullet in `### Skill-side rules` ("Skills ignore it for
  now; the handling lands with #798") with: hand off per [Clearing](#clearing)
  instead of running the command inline.

### Step 2 — Next-step map and other "until #798" mentions

- `skill-finish.md` Next-step map notes: in the **Auto keys** note, add that a hop
  whose `next_step.clear.<skill>` is also `true` hands off per Clearing; in the
  **Top-level `auto-plan-issue`** note, describe `AUTO_CLEAR=true` before
  `AUTO_NEXT=` and the coordinator's Clearing handling; in the **`discuss-issue`**
  note, the clearing first hop runs `/auto-plan-issue` top-level.
- `docs/guides/arcanum-repo-config.md:103` — drop "in a follow-up (#798)"; link the
  Clearing subsection.
- `docs/agents/folder-structure.md:23` — replace "It stays inert until a skill
  calls it (#798)" with the skills that call it (via Clearing).
- `README.md:105` — replace the "Inert for now" bullet accordingly.

## Files to Change

- `docs/agents/architecture/skill-finish.md` — Clearing subsection, skill-side rule, Next-step map notes.
- `docs/guides/arcanum-repo-config.md` — remove the follow-up wording.
- `docs/agents/folder-structure.md` — mod row no longer inert.
- `README.md` — mod bullet no longer inert.

## Notes

- Refer to the tool only as `mcp__arcanum-next-step__handoff` (mod README stability rule).
