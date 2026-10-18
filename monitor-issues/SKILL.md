---
name: monitor-issues
description: Polls GitHub once per cycle for issues created by the current user, writes parsed metadata and tags to a shared JSON state file, and loops — either inline or, when clear_context is enabled, clears context through the arcanum-next-step mod (falling back to a ScheduleWakeup restart that keeps context). Usage: /monitor-issues (or /loop /monitor-issues for context-clearing mode)
---

You are acting as the **architect**. Your job is to run one polling cycle and then decide whether to loop inline or reschedule — no user interaction.

## Step 1 — Run one polling cycle

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd (every loop iteration, including a mod-submitted `/loop /monitor-issues` after a `clear_context` handoff and a fresh `ScheduleWakeup` re-entry, re-resolves it here, since each such re-entry is itself a fresh trust point). Then run:

```bash
scripts/monitor_issues.sh "$REPO_PATH"
```

This runs one poll: fetches issues updated since the last check, updates `.claude/state/issues.json`, and exits. It does not loop internally.

## Step 2 — Check whether to clear context

```bash
scripts/config.sh is-enabled clear_context
```

- **Exit 1 (`false` or absent):** go back to Step 1 (loop inline in the same context).
- **Exit 0 (`true`):** hand off to a fresh iteration, using the first level that works (the unattended-loop variant of [Clearing](../docs/agents/architecture/skill-finish.md#clearing), which holds the shared contract):
  1. **Mod.** If `mcp__arcanum-next-step__handoff` is in the tool list (the `arcanum-next-step` mod is loaded), call it with `{ command: "/loop /monitor-issues" }`. On a success result, end the turn with no further output. The mod runs `/clear`, then the command, and the fresh iteration re-reads `.claude/state/issues.json`, so the context really is freed.
     - Error `a handoff is already pending: ...`: end the turn. Do not fall back, so the command doesn't fire twice.
  2. **Fallback.** On any other error result, or if the tool is missing, print one line, `clear skipped: <reason>`, then call `ScheduleWakeup(delaySeconds=60, prompt="/monitor-issues", reason="restarting before next poll cycle")` and stop. This restart re-runs the skill from the top in the **same** conversation and keeps all earlier context; it does not clear anything.

  There is deliberately no "type /clear now" level: the loop runs unattended. Requires invocation via `/loop /monitor-issues`, since the fallback wakeup depends on it.
