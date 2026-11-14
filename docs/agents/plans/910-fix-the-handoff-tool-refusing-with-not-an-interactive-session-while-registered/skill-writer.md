# Skill-writer Plan: Fix the handoff tool refusing with "not an interactive session" while registered

Main plan: [plan.md](plan.md)

## Shared contracts

- The mod no longer returns `handoff is only available in an interactive session`. Its level-1 deny texts are `handoff only runs arcanum skills`, `handoff is only available on the main loop`, `a handoff is already pending: <command>` and `arcanum-next-step: handoff failed`.
- Ladder: on `a handoff is already pending: ...`, end the turn. On any other error, or a failed call, go to level 2 (`ScheduleWakeup`, loaded via `ToolSearch` if it is deferred). Go to level 3 only when `ScheduleWakeup` is missing or fails. When the tool is not listed, start at level 2.

## Implementation Steps

### Step 1 — Reword the five handoff call sites

Each site currently says "hand off `<cmd>` per [Clearing](...) (through `mcp__arcanum-next-step__handoff` when available)". The parenthetical reads as "mod, else inline", and in ward the model went from a level-1 refusal straight to level 3. Replace the parenthetical at every site with an explicit instruction, kept short and identical in meaning everywhere. For example: "apply [Clearing](...)'s levels in order: level 1 (the mod's `handoff` tool, if listed); after any level-1 error other than `a handoff is already pending`, or with no tool listed, level 2 (`ScheduleWakeup`, loaded via `ToolSearch` if deferred); level 3 (in place) only if level 2 is unavailable or fails". Keep each site's own in-place wording, as the issue asks: no shared step file.

In `auto-plan-issue/SKILL.md`, the sentence "Its in-place level is the inline `Skill(loop, ...)` call above" must come after the level-2 wording and say clearly that it is level 3, so it no longer reads as the immediate fallback.

Do not change `auto-fix-all/SKILL.md` or `monitor-issues/SKILL.md`. They deliberately skip level 2 because they run unattended.

### Step 2 — Update the Clearing section of skill-finish.md

In `docs/agents/architecture/skill-finish.md#clearing`:
- Level 1's "any other error result" list: drop `only available in an interactive session`, and add the catch-all `handoff failed`.
- Level 2: add one sentence saying it applies to every interactive skill whether or not the run is inside `/loop`. `ScheduleWakeup` is called here only to resume `<cmd>` after the user's `/clear`.

## Files to Change
- `discuss-issue/steps/discuss_and_save.md` — the two hand-off sites (the first-offer `CLEAR=true` path, step 4, and the second-offer `CLEAR=true` bullet).
- `enhance-issue/steps/publish.md` — the `CHOICE=yes` with `AUTO=true` and `CLEAR=true` bullet.
- `plan-issue/steps/write_and_confirm.md` — the `CHOICE=yes` with `AUTO=true` and `CLEAR=true` bullet.
- `auto-plan-issue/SKILL.md` — the `AUTO_CLEAR=true` paragraph, with the in-place sentence reordered to come after level 2.
- `docs/agents/architecture/skill-finish.md` — the Clearing level-1 error list and the level-2 note.

## CI Checks
- Repo docs/skills: run the markdown lint used in CI, if `.circleci/config.yml` has a job for it. Otherwise none.

## Notes
- `skill-finish.md` is architecture documentation. It is included here because the change is the doc version of the same wording fix. The architect reviews it.
- The `skill-reviewer` agent should check the reworded sites. No new inline bash is introduced.
