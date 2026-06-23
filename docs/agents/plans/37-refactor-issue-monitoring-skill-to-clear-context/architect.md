# Architect Plan: Refactor Issue Monitoring Skill to Clear Context

Main plan: [plan.md](plan.md)

## Shared contracts

- `scripts/config.sh is-enabled clear_context` → exit 0 if true, exit 1 if false/absent.
- `monitor_issues.sh` now exits after one cycle — SKILL.md drives the loop.
- ScheduleWakeup: `(delaySeconds=60, prompt="/monitor-issues", reason="clearing context before next poll cycle")`.

## Implementation Steps

### Step 1 — Rewrite `monitor-issues/SKILL.md`

Replace the current single-step "run the script forever" SKILL.md with a loop-aware version:

```markdown
---
name: monitor-issues
description: Polls GitHub once per cycle for issues created by the current user, writes parsed metadata and tags to a shared JSON state file, and loops — either inline or with a fresh context via ScheduleWakeup when clear_context is enabled. Usage: /monitor-issues (or /loop /monitor-issues for context-clearing mode)
---

You are acting as the **architect**. Your job is to run one polling cycle and then decide whether to loop inline or reschedule — no user interaction.

## Step 1 — Run one polling cycle

```bash
scripts/monitor_issues.sh
```

This runs one poll: fetches issues updated since the last check, updates `.claude/state/issues.json`, and exits. It does not loop internally.

## Step 2 — Check whether to clear context

```bash
scripts/config.sh is-enabled clear_context
```

- **Exit 1 (`false` or absent):** go back to Step 1 (loop inline in the same context).
- **Exit 0 (`true`):** call `ScheduleWakeup(delaySeconds=60, prompt="/monitor-issues", reason="clearing context before next poll cycle")` and stop. The next invocation resumes in a fresh context. Requires invocation via `/loop /monitor-issues`.
```

### Step 2 — Create `toggle-monitor-clear-context/SKILL.md`

```markdown
---
name: toggle-monitor-clear-context
description: Toggles the clear_context setting for the monitor-issues skill. When enabled and invoked via /loop, the monitor clears its conversation context between polling cycles using ScheduleWakeup. Usage: /toggle-monitor-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

\`\`\`bash
../monitor-issues/scripts/config.sh toggle clear_context
\`\`\`

## Step 2 — Report

Report the new value: "clear_context is now ON (monitor-issues will clear context between polling cycles when invoked via /loop)" or "clear_context is now OFF (monitor-issues will loop in the same context)".

Note: context clearing only takes effect when monitor-issues is invoked via `/loop /monitor-issues` — `ScheduleWakeup` requires /loop dynamic mode. There is a 60-second gap between cycles when enabled.
```

## Files to Change

- `monitor-issues/SKILL.md` — rewrite to loop-aware version
- `toggle-monitor-clear-context/SKILL.md` — create new skill

## Notes

- The `scripts/config.sh is-enabled` exit-code pattern (not stdout) is what the SKILL.md checks — consistent with issue #35's final implementation.
- Do not change `monitor_issues.sh` — that is the scripter's work.
