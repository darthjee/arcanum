# Skill-writer Plan: `clear_context` (auto-fix-all, monitor-issues) does not actually clear context

Main plan: [plan.md](plan.md)

## Overview

Make the `clear_context` toggles really clear context through the
`arcanum-next-step` mod, and make every doc and skill text describe what actually
happens. Only Markdown changes. The config key `clear_context`, both toggle skills,
`config.sh`/`config_common.sh` and the Node `*Config.js` classes stay as they are.

## Context

Spike #791 showed that the current `ScheduleWakeup(delaySeconds=60, ...)` restart
runs in the same conversation and frees no context. Epic #790 shipped the
`arcanum-next-step` mod (#797), whose `mcp__arcanum-next-step__handoff` tool runs
`/clear` and then an allowlisted arcanum command (`/loop /<skill>` is allowed) once
the turn ends. #798 documented the shared ladder in
`docs/agents/architecture/skill-finish.md#clearing`. These loops run unattended,
so they use a two-level variant: mod, otherwise today's wakeup restart, with no
"type /clear now" level.

Decided in discussion:

- Mod first. On `a handoff is already pending: ...`, end the turn with no fallback.
  On any other error, or if the tool is missing, print `clear skipped: <reason>`
  and do the existing 60-second `ScheduleWakeup` re-entry.
- `clear_context` off: unchanged (loop inline).
- `auto-fix-all`'s `OUTCOME=pending` 300-second wakeup is unrelated and stays
  as it is.
- The #791 codeword test is a manual check by the repo owner after merge, not
  part of the implementation.

## Steps

- [01 — Document the unattended-loop variant in Clearing](skill-writer/01-clearing-unattended-loops.md)
- [02 — auto-fix-all: hand off instead of the clearing wakeup](skill-writer/02-auto-fix-all-handoff.md)
- [03 — monitor-issues: hand off instead of the clearing wakeup](skill-writer/03-monitor-issues-handoff.md)
- [04 — Correct the toggle skills and init-claude setup text](skill-writer/04-toggles-and-init-claude.md)
- [05 — Correct README and architecture docs](skill-writer/05-readme-and-docs.md)

## Notes

- Always name the tool by its full name, `mcp__arcanum-next-step__handoff`
  (stability rule in `arcanum-next-step/README.md`).
- The handoff command has no queue ids, `/loop /auto-fix-all`. With no arguments,
  Step 1 re-reads the queue, just as the existing wakeup prompt `/auto-fix-all` does.
- Whether a running `/loop` survives `/clear` (and whether a fresh `/loop` starts
  cleanly after it) is checked by the owner's manual codeword test. If it fails,
  that's a follow-up for the mod, not for this change.
- `docs/agents/specs/arcanum-cli/key-registry.md`, `shortcuts-and-setup.md` and
  `arcanum-cli.md` only name the keys and make no claim about clearing, so no change
  is expected there. Re-grep to confirm. `arcanum/migrations/repos/0.18.0/002.md`
  is a historical migration and stays untouched.
- The docs in step 05 are architect-owned root docs. They are bundled here because
  they are text-only and track the skill wording exactly. The coordinator may take
  that step itself instead of dispatching it.
