---
name: toggle-monitor-clear-context
description: Toggles the clear_context setting for the monitor-issues skill. When enabled and invoked via /loop, the monitor clears its conversation context between polling cycles through the arcanum-next-step mod, or, without the mod, restarts via ScheduleWakeup without freeing context. Usage: /toggle-monitor-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

```bash
../monitor-issues/scripts/config.sh toggle clear_context
```

## Step 2 — Report

Report the new value: "clear_context is now ON (monitor-issues will clear context between polling cycles through the arcanum-next-step mod when invoked via /loop; without the mod it restarts via ScheduleWakeup and keeps context)" or "clear_context is now OFF (monitor-issues will loop in the same context)".

Note: the setting only takes effect when monitor-issues is invoked via `/loop /monitor-issues`. With the `arcanum-next-step` mod loaded, the context is really cleared and the next cycle starts right after the turn ends. Without the mod, monitor-issues prints a `clear skipped: <reason>` line and restarts through a 60-second `ScheduleWakeup`, which keeps the conversation context.
