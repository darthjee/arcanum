---
name: toggle-clear-context
description: Toggles the clear_context setting for auto-fix-all. When enabled, auto-fix-all spawns a fresh agent after each issue to continue processing with a clean context. Usage: /toggle-clear-context
---

You are acting as the **architect**. Toggle the `clear_context` setting — no user interaction.

## Step 1 — Toggle the setting

Run:

```bash
../auto-fix-all/scripts/config.sh toggle clear_context
```

## Step 2 — Report

Report the new value: "clear_context is now ON (auto-fix-all will spawn a fresh agent after each issue to continue processing with a clean context)" or "clear_context is now OFF (auto-fix-all will loop in the same context)".

Note: when enabled, `auto-fix-all` spawns a fresh agent after each issue to continue processing with a clean context.
