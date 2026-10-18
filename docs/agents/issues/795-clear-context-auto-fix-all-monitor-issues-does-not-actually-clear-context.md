# Issue: `clear_context` (auto-fix-all, monitor-issues) does not actually clear context

## Description

The `clear_context` toggles of `auto-fix-all` and `monitor-issues` claim to clear the
conversation context between iterations, but they don't. Now that epic #790 has
shipped the `arcanum-next-step` mod (#797) and the shared
[Clearing](docs/agents/architecture/skill-finish.md#clearing) protocol (#798), make
these toggles really clear context through the mod, and describe the fallback
honestly.

## Problem

With `clear_context` on, both skills call `ScheduleWakeup(delaySeconds=60,
prompt="/auto-fix-all" | "/monitor-issues")` and stop, under `/loop`. Spike #791 showed
that the woken iteration runs in the **same** conversation with all earlier context
intact:

- **Q1:** a codeword planted before a `/loop` + `ScheduleWakeup` restart was still
  visible to the woken iteration.
- **Docs:** the Claude Code scheduled-tasks docs say built-ins such as `/clear` sent
  through `/loop` fires "reach Claude as plain text instead of executing."

Several places still say these toggles clear or reset context:

- `auto-fix-all/SKILL.md` (Step 3, "Check whether to clear context"), and
  `toggle-clear-context/SKILL.md`.
- `monitor-issues/SKILL.md` (frontmatter description and Step 2), and
  `toggle-monitor-clear-context/SKILL.md`.
- `init-claude/setup_auto_fix_all_settings.md`.
- `docs/agents/architecture/shared-state-and-configuration.md`, `README.md`,
  `docs/agents/specs/arcanum-cli/key-registry.md` and
  `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`, plus any other README or
  spec text with the same claim.

## Expected Behavior

With `clear_context` on, each point where the skill used to schedule the
"clearing" wakeup does this instead:

- `auto-fix-all`: Step 3, `OUTCOME=merged`, after the `finish_on_empty_queue` check.
- `monitor-issues`: Step 2, after one polling cycle.

1. **Mod.** If `mcp__arcanum-next-step__handoff` is in the tool list, call it with
   `{ command: "/loop /auto-fix-all" }` or `{ command: "/loop /monitor-issues" }`.
   On success, end the turn with no further output. The mod runs `/clear` and then
   the command, which starts a fresh `/loop` iteration that re-reads its state (the
   queue, or `.claude/state/issues.json`).
   - Error `a handoff is already pending: ...`: end the turn without falling back,
     so the command doesn't fire twice.
2. **Fallback.** On any other error result, or if the tool is missing, print one
   line, `clear skipped: <reason>`, and keep today's behavior: the 60-second
   `ScheduleWakeup` re-entry, which re-runs the skill from the top **without**
   freeing context. These loops run unattended, so the Clearing protocol's level 2
   ("type /clear now") is deliberately **not** used here.

With `clear_context` off, behavior is unchanged: loop inline.

Unrelated wakeups are untouched, e.g. `auto-fix-all`'s `OUTCOME=pending` 300-second
wakeup, which only waits for a PR.

Every doc and skill text listed under Problem says what really happens: a real
clear when the `arcanum-next-step` mod is loaded, otherwise a wakeup restart that
keeps context.

## Solution

- Replace the "clearing" `ScheduleWakeup` call in `auto-fix-all/SKILL.md` and
  `monitor-issues/SKILL.md` with the two-level handoff above. Reference
  `skill-finish.md#clearing` for the mod's contract (full tool name, error
  handling), and record the unattended-loop variant there as a note: no level 2,
  and the fallback is the plain wakeup restart.
- Keep the config key name `clear_context` and both toggle skills. Only their
  descriptions change.
- Both loops still need to be started via `/loop`, since the fallback and
  `auto-fix-all`'s `pending` wakeup depend on it.
- Update every doc and spec listed under Problem.

### Acceptance criteria

- [ ] No arcanum doc or skill claims that `clear_context` clears context without
      saying it depends on the `arcanum-next-step` mod. The fallback is described
      as a restart that keeps context.
- [ ] `auto-fix-all` and `monitor-issues` call `mcp__arcanum-next-step__handoff`
      with `/loop /auto-fix-all` or `/loop /monitor-issues` when `clear_context`
      is on and the tool is present, and fall back to the wakeup restart, with a
      `clear skipped: <reason>` line, otherwise.
- [ ] **Manual check by the repo owner** (the autonomous pipeline can't observe
      `/loop` or `/clear`): after the change, the #791 Q1 codeword test passes for
      at least `monitor-issues` with `clear_context` on and the mod loaded. The
      codeword is no longer visible after the handoff, and the new `/loop`
      iteration keeps running. The result is posted on the PR or this issue.

## Benefits

- The toggles finally do what they claim, so long unattended runs stop piling up
  context.
- Reuses #790's mod and Clearing protocol instead of inventing a second mechanism.
- When no clear is possible, the docs and the `clear skipped` line say so honestly.
