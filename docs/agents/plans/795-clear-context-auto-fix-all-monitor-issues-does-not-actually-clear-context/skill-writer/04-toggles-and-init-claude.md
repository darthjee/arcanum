# Correct the toggle skills and init-claude setup text

Reword every place that says the toggle clears context "using ScheduleWakeup".
None of the commands or scripts change.

- `toggle-clear-context/SKILL.md`
  - Frontmatter `description`: the toggle makes `auto-fix-all` clear its
    conversation context between issues through the `arcanum-next-step` mod when
    invoked via `/loop`, or, without the mod, restart via `ScheduleWakeup` without
    freeing context.
  - Step 3's closing note: replace "context clearing only takes effect when ...
    `ScheduleWakeup` requires /loop dynamic mode. There is a 60-second gap between
    issues." with the real behavior. It needs `/loop /auto-fix-all <ids>`. With the
    mod loaded, context is really cleared and the next issue starts right after the
    turn ends. Without it, a 60-second wakeup restart keeps context, and a
    `clear skipped: <reason>` line is printed.
- `toggle-monitor-clear-context/SKILL.md`
  - Frontmatter `description` and the Step 3 ON message: same correction for
    `monitor-issues` polling cycles.
- `init-claude/setup_auto_fix_all_settings.md`
  - The `clear_context` row's description (line ~24): "Clear conversation context
    between issues through the `arcanum-next-step` mod; without the mod, a
    `ScheduleWakeup` restart that keeps context. Only takes effect when
    `auto-fix-all` is invoked through `/loop`."

## Files to Change

- `toggle-clear-context/SKILL.md` — description and Step 3 note.
- `toggle-monitor-clear-context/SKILL.md` — description and Step 3 report text.
- `init-claude/setup_auto_fix_all_settings.md` — `clear_context` row description.
