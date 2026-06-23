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
