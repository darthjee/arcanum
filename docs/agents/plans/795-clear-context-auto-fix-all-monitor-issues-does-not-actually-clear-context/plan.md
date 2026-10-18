# Plan: `clear_context` (auto-fix-all, monitor-issues) does not actually clear context

Issue: [795-clear-context-auto-fix-all-monitor-issues-does-not-actually-clear-context.md](../../issues/795-clear-context-auto-fix-all-monitor-issues-does-not-actually-clear-context.md)

## Overview

When `clear_context` is on, `auto-fix-all` and `monitor-issues` replace their
"clearing" `ScheduleWakeup` with a call to `mcp__arcanum-next-step__handoff`
(`/loop /auto-fix-all` or `/loop /monitor-issues`). If the mod is unavailable, they
fall back to today's wakeup restart and print a `clear skipped: <reason>` line. Every
doc that claims these toggles clear context is corrected. Only Markdown changes;
no script, config key or Node code changes.

See [skill-writer.md](skill-writer.md) for the full plan.
