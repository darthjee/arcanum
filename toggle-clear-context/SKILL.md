---
name: toggle-clear-context
description: Toggles the clear_context setting for auto-fix-all. When enabled and invoked via /loop, auto-fix-all clears its conversation context between issues using ScheduleWakeup. Usage: /toggle-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Resolve REPO_PATH

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd.

## Step 2 — Toggle the setting

Run:

```bash
../auto-fix-all/scripts/config.sh toggle "$REPO_PATH" clear_context
```

## Step 3 — Report

Report the new value: "clear_context is now ON" or "clear_context is now OFF (auto-fix-all will loop in the same context)".

Note: context clearing only takes effect when `auto-fix-all` is invoked via `/loop /auto-fix-all <ids>` — `ScheduleWakeup` requires /loop dynamic mode. There is a 60-second gap between issues.
