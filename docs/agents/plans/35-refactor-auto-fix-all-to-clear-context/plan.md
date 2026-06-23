# Plan: Refactor Auto-Fix-All to Clear Context

Issue: [35-refactor-auto-fix-all-to-clear-context.md](../issues/35-refactor-auto-fix-all-to-clear-context.md)

## Overview

Add a `clear_context` boolean flag to the `auto-fix-all` configuration; when enabled, the skill uses `ScheduleWakeup` to re-invoke itself with a fresh conversation context after each issue is merged, rather than looping forever in the same conversation. A new `toggle-clear-context` skill (backed by a config script) lets the user flip the flag at any time.

## How context clearing works

`ScheduleWakeup` is a harness tool that only fires inside `/loop` dynamic mode. Therefore context clearing only takes effect when the user invokes auto-fix-all via `/loop /auto-fix-all <ids>`. When invoked directly as `/auto-fix-all <ids>`, the flag is checked but has no effect (the skill can't self-reschedule outside /loop).

When `clear_context=true` and an issue is merged:
1. `queue.sh pop` removes the finished issue.
2. The skill calls `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all")` and stops.
3. 60 seconds later, `/auto-fix-all` is re-invoked with no arguments and a fresh context.
4. Because no arguments were given, Step 1 is skipped; the skill goes straight to Step 2 and reads the next ID from the persisted queue.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

### `auto-fix-all/scripts/config.sh` interface (scripter → architect)

```
config.sh get <key>          — prints "true" or "false" to stdout; exits 0
config.sh set <key> <value>  — writes the key to config JSON; exits 0
config.sh toggle <key>       — flips a boolean key; prints the new value; exits 0
```

- Reads/writes `.claude/configuration/auto-fix-all.json`.
- Missing key → treated as `false` for boolean reads.
- Uses the same lock pattern as `queue.sh` (lock file: `.claude/state/auto-fix-all-config.lock`).

### Config field (scripter → architect)

New field in `.claude/configuration/auto-fix-all.json`:
```json
{ "ignored_check_patterns": [...], "clear_context": false }
```
Default (if key absent): `false`.

### ScheduleWakeup call (architect — in monitor_pr.md and SKILL.md)

When clearing context after a merge:
```
ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")
```
Then stop — do not loop back to Step 2.
