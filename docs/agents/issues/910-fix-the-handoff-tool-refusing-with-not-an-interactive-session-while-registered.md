# Issue: Fix the handoff tool refusing with "not an interactive session" while registered

## Description

Part of #900.

`arcanum-next-step/hooks/register.ts` registers the `handoff` tool only when `session.start` reports `isInteractive: true`, and saves that flag in `$.state` (`interactive`). `tool.call` refuses with `NOT_INTERACTIVE` when the saved flag reads false (or was never written, which defaults to false). In the ward session the tool was listed, but the very first call of a fresh session (no earlier `/clear` or resume) was refused with "handoff is only available in an interactive session". So the saved flag disagreed with the registration. Ward then went straight to level 3 ("clear skipped") of [Clearing](../architecture/skill-finish.md#clearing), skipping level 2.

## Problem

Two defects:

1. **Flag and registration disagree.** The tool can only be registered after `session.start` saw `isInteractive: true` and wrote `true` to `$.state`, yet the first call read it back as false. The root cause is unknown. Candidates:
   - the `$.state` write not landing (for example, the ref's `plugin: 'arcanum-next-step'` not matching `$.plugin.name` under the installed name);
   - a worker respawn or re-enable resetting state while the registration survives.

   A separate lifetime mismatch also exists. Per the host types, `/clear` and resume continue the process under a new session id with no `session.start`, while `$.state` is held "for the session" and a `$.tool.register` lasts for the process. That would break the second hop of a `CLEAR=true` chain too. If the cause is a failed state write, the `pending` handoff state is affected as well, and an accepted handoff would never run at turn end.
2. **The level-2 fallback is skipped.** Every call site (`discuss-issue/steps/discuss_and_save.md` twice, `enhance-issue/steps/publish.md`, `plan-issue/steps/write_and_confirm.md`, `auto-plan-issue/SKILL.md`) says "hand off per Clearing (through `mcp__arcanum-next-step__handoff` when available)". The parenthetical reads as "mod, otherwise inline". `auto-plan-issue/SKILL.md` also names the in-place level right away. So the model can jump from a level-1 error straight to level 3.

## Expected Behavior

- Whenever the `handoff` tool is listed, a main-loop call with an arcanum command is accepted: on the first call of a fresh session and after `/clear`, resume, compaction and hot reload.
- An accepted handoff actually runs `/clear` and then the command at turn end, so the `pending` state round-trips.
- The tool is still never offered in a headless (`-p`) or SDK run.
- When level 1 fails with any error other than "already pending", the skill tries level 2 (`ScheduleWakeup` plus `type /clear now; <cmd> resumes in ~60s`) before it falls back to level 3.

## Solution

**Mod (owner: `mod`):**
- Drop the call-time `interactive` check and the `interactive` state key (in `register.ts` and `types/index.d.ts`). The registration is already gated on `isInteractive` and lasts for the process, so a listed tool means an interactive session. Keep the `NOT_MAIN_LOOP` check. Remove `NOT_INTERACTIVE`, then update the tests and README.
- Investigate why the flag read back false on a fresh session's first call. If `$.state` writes do not land (ref/plugin-name mismatch, respawn reset), fix that too, because `pending` depends on the same mechanism. Add a test that a `tool.call` → `turn.complete` round-trip runs the command.
- Add a test that a call is accepted with no `interactive` state written (the reload / `/clear` shape).

**Skills (owner: `skill-writer`):**
- Reword the five handoff call sites so they say plainly to apply Clearing levels 1 → 2 → 3 in order, with level 2 (`ScheduleWakeup`, loaded via `ToolSearch` if it is deferred) mandatory after a non-"pending" level-1 error. Do not extract a shared step file.
- In `docs/agents/architecture/skill-finish.md#clearing`, drop `only available in an interactive session` from the level-1 error list. If needed, state that level 2 applies even outside `/loop`.

## Benefits

`CLEAR=true` chains actually free context at every hop instead of quietly running in place, and the fallback works as documented when the mod does refuse.
