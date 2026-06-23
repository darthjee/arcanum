---
name: toggle-monitor-clear-context
description: Toggles the clear_context setting for the monitor-issues skill. When enabled and invoked via /loop, the monitor clears its conversation context between polling cycles using ScheduleWakeup. Usage: /toggle-monitor-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

```bash
../monitor-issues/scripts/config.sh toggle clear_context
```

## Step 2 — Report

Report the new value: "clear_context is now ON (monitor-issues will clear context between polling cycles when invoked via /loop)" or "clear_context is now OFF (monitor-issues will loop in the same context)".

Note: context clearing only takes effect when monitor-issues is invoked via `/loop /monitor-issues` — `ScheduleWakeup` requires /loop dynamic mode. There is a 60-second gap between cycles when enabled.
