# Plan: Refactor Issue Monitoring Skill to Clear Context

Issue: [37-refactor-issue-monitoring-skill-to-clear-context.md](../issues/37-refactor-issue-monitoring-skill-to-clear-context.md)

## Overview

Refactor the `monitor-issues` skill so that the polling loop is controlled by the Claude `SKILL.md` rather than entirely inside the bash script. This allows a `clear_context` flag to trigger `ScheduleWakeup` between cycles (requiring `/loop /monitor-issues`), or to loop inline when the flag is off. A new `toggle-monitor-clear-context` skill (backed by `monitor-issues/scripts/config.sh`) lets the user flip the flag at any time.

## How it works

Currently, `monitor_issues.sh` contains a `while true` loop and runs forever. After this refactor:
- `monitor_issues.sh` runs **one polling cycle** and exits.
- `monitor-issues/SKILL.md` drives the loop:
  - After each cycle, check `scripts/config.sh is-enabled clear_context`.
  - **Exit 1 (false/absent):** loop back to Step 1 (run the script again in the same context).
  - **Exit 0 (true):** call `ScheduleWakeup(delaySeconds=60, prompt="/monitor-issues", reason="clearing context before next poll cycle")` and stop. The next invocation resumes with a fresh context. Requires invocation via `/loop /monitor-issues`.

The 60-second minimum delay from ScheduleWakeup replaces the 5-second sleep between cycles when `clear_context=true`. This is the same trade-off accepted in issue #35.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

### `monitor-issues/scripts/config.sh` interface (scripter → architect)

Same command set as `auto-fix-all/scripts/config.sh`, but pointing to a separate config file:

```
config.sh get <key>          — prints "true" or "false"; exits 0
config.sh set <key> <value>  — writes to config JSON; exits 0
config.sh toggle <key>       — flips boolean; prints new value; exits 0
config.sh is-enabled <key>   — exits 0 if true, exits 1 if false/absent
```

Config file: `.claude/configuration/monitor-issues.json`
Lock file: `.claude/state/monitor-issues-config.lock`
Default for missing key: `false`.

### `monitor_issues.sh` behaviour after refactor (scripter → architect)

- Runs **one** polling cycle and exits (no `while true` loop inside the script).
- The 5-second `sleep 5` at the end of the loop is removed (the SKILL.md controls pacing).
- Everything else (locking, JSON writes, tag extraction, GitHub API call) is unchanged.

### ScheduleWakeup call (architect — in SKILL.md)

```
ScheduleWakeup(delaySeconds=60, prompt="/monitor-issues", reason="clearing context before next poll cycle")
```
