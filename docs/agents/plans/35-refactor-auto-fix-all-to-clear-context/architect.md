# Architect Plan: Refactor Auto-Fix-All to Clear Context

Main plan: [plan.md](plan.md)

## Shared contracts

- `auto-fix-all/scripts/config.sh get clear_context` → prints `"true"` or `"false"`, exits 0.
- `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")` is how the skill self-reschedules.
- No args to `/auto-fix-all` means "re-invocation with cleared context — skip queue save, go straight to Step 2."

## Implementation Steps

### Step 1 — Update `auto-fix-all/SKILL.md` Step 1 to handle no-args re-invocation

Change Step 1 from unconditionally running `queue.sh save` to:

> If skill arguments were provided, run `scripts/queue.sh save <ids>`. If no arguments were given (this is a re-invocation after context clearing), skip this step and go directly to Step 2 — the queue already contains the remaining issues.

### Step 2 — Update `auto-fix-all/steps/monitor_pr.md` — add clear_context check after each merge/pop

In the **"If `merged`"** section, after `scripts/queue.sh pop`, insert:

> Check the clear_context setting:
> ```bash
> scripts/config.sh get clear_context
> ```
> - If it prints `true`: call `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")` and stop. Do not loop back to Step 2.
> - If it prints `false` (or the script is absent/fails): go back to Step 2 of `SKILL.md` as before.

Apply the same check in the **"If `approved`"** section, after `scripts/github.sh pr-merge` and the subsequent `scripts/queue.sh pop`.

### Step 3 — Create `toggle-clear-context/SKILL.md`

Create a new skill folder `toggle-clear-context/` with `SKILL.md`:

```markdown
---
name: toggle-clear-context
description: Toggles the clear_context setting for auto-fix-all. When enabled, auto-fix-all clears its conversation context between issues (requires invocation via /loop /auto-fix-all). Usage: /toggle-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

Run:

\`\`\`bash
../auto-fix-all/scripts/config.sh toggle clear_context
\`\`\`

## Step 2 — Report

Report the new value: "clear_context is now ON (auto-fix-all will clear context between issues when invoked via /loop)" or "clear_context is now OFF (auto-fix-all will loop in the same context)".

Note: context clearing only takes effect when auto-fix-all is invoked via `/loop /auto-fix-all <ids>`.
```

## Files to Change

- `auto-fix-all/SKILL.md` — handle no-args re-invocation in Step 1
- `auto-fix-all/steps/monitor_pr.md` — add clear_context check after pop in merged and approved branches
- `toggle-clear-context/SKILL.md` — new skill

## Notes

- Do not modify `process_next.md` — the context-clearing hook belongs at the point where the queue advances (after merge), not at the point where the next issue is fetched.
- The check is only meaningful inside /loop dynamic mode; outside that mode the ScheduleWakeup call will have no effect, but it is still harmless to check.
