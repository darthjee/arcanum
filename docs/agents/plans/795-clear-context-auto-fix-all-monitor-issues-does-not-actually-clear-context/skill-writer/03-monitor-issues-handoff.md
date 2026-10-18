# monitor-issues: hand off instead of the clearing wakeup

In `monitor-issues/SKILL.md`:

- **Step 2, Exit 0 (`true`)**: same two levels as `auto-fix-all`.
  1. If `mcp__arcanum-next-step__handoff` is present, call it with
     `{ command: "/loop /monitor-issues" }`. On success, end the turn with no
     further output. On `a handoff is already pending: ...`, end the turn.
  2. Otherwise print `clear skipped: <reason>` and call
     `ScheduleWakeup(delaySeconds=60, prompt="/monitor-issues", reason="restarting before next poll cycle")`,
     then stop. Remove the false sentence "The next invocation resumes in a fresh
     context". Say instead that the restart keeps context.

  Link to [Clearing](../docs/agents/architecture/skill-finish.md#clearing).
- **Frontmatter `description`**: replace "with a fresh context via ScheduleWakeup
  when clear_context is enabled" with wording like "or, when clear_context is
  enabled, clears context through the arcanum-next-step mod (falling back to a
  ScheduleWakeup restart that keeps context)". Keep the `Usage:` part. "for
  context-clearing mode" can stay, since it's now accurate when the mod is loaded.
- Step 1's note about "a fresh `ScheduleWakeup` re-entry" re-resolving
  `REPO_PATH` also applies to the mod-submitted `/loop /monitor-issues`. Mention
  both.

## Files to Change

- `monitor-issues/SKILL.md` — frontmatter description, Step 1 note, Step 2
  `clear_context` branch.
