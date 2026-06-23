---
name: toggle-clear-context
description: Toggles the clear_context setting for auto-fix-all. When enabled and invoked via /loop, auto-fix-all clears its conversation context between issues using ScheduleWakeup. Usage: /toggle-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

Run:

```bash
../auto-fix-all/scripts/config.sh toggle clear_context
```

## Step 2 — Report

Report the new value: "clear_context is now ON" or "clear_context is now OFF (auto-fix-all will loop in the same context)".

Note: context clearing only takes effect when `auto-fix-all` is invoked via `/loop /auto-fix-all <ids>` — `ScheduleWakeup` requires /loop dynamic mode. There is a 60-second gap between issues.
