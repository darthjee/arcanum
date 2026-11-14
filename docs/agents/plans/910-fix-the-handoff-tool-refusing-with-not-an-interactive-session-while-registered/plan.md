# Plan: Fix the handoff tool refusing with "not an interactive session" while registered

Issue: [910-fix-the-handoff-tool-refusing-with-not-an-interactive-session-while-registered.md](../../issues/910-fix-the-handoff-tool-refusing-with-not-an-interactive-session-while-registered.md)

## Overview

The `arcanum-next-step` mod stops gating `handoff` calls on a stored `interactive` flag. The tool registration, which `session.start` already limits to interactive sessions and which lasts for the process, becomes the only gate. The mod also investigates, and fixes if it is real, any failure of `$.state` writes, because the `pending` handoff depends on them too. Separately, the five skill call sites that hand off "per Clearing" are reworded so that a level-1 refusal always goes to the level-2 `ScheduleWakeup` fallback before the in-place level 3.

## Agents involved

- [mod](mod.md)
- [skill-writer](skill-writer.md)

## Shared contracts

- **Level-1 error results after this change.** The mod's `handoff` tool returns exactly these `deny` texts. Every other error string is gone.
  - `handoff only runs arcanum skills`
  - `handoff is only available on the main loop`
  - `a handoff is already pending: <command>`
  - `arcanum-next-step: handoff failed` (the catch-all)

  `handoff is only available in an interactive session` (`NOT_INTERACTIVE`) is removed. `docs/agents/architecture/skill-finish.md#clearing` must stop listing it.
- **Clearing ladder (unchanged semantics, clarified wording).** On `a handoff is already pending: ...`, end the turn. On any other error result, or a failed call, go to level 2 (`ScheduleWakeup(delaySeconds=60, prompt="<cmd>", ...)`, loaded via `ToolSearch` if it is deferred). Go to level 3 only if `ScheduleWakeup` is missing or fails. When the tool is not listed at all, start at level 2.
- **Headless behaviour (unchanged).** Under `claude -p` or an SDK host the tool is still not registered, so skills see it as absent and start at level 2.
