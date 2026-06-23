# Scripter Plan: Refactor Issue Monitoring Skill to Clear Context

Main plan: [plan.md](plan.md)

## Shared contracts

- `monitor-issues/scripts/config.sh` (this agent creates it): same interface as `auto-fix-all/scripts/config.sh` but with `CONFIG_FILE=".claude/configuration/monitor-issues.json"` and `LOCK_FILE=".claude/state/monitor-issues-config.lock"`.
- `monitor_issues.sh` after refactor: runs ONE cycle and exits — no `while true` loop, no trailing `sleep 5`.

## Implementation Steps

### Step 1 — Create `monitor-issues/scripts/config.sh`

Copy `auto-fix-all/scripts/config.sh` verbatim and change only:
- The header comment to say it manages `monitor-issues` config.
- `CONFIG_FILE=".claude/configuration/monitor-issues.json"`
- `LOCK_FILE=".claude/state/monitor-issues-config.lock"`
- The usage line at the bottom to reference `monitor-issues/scripts/config.sh`.

Everything else — `_acquire_lock`, `_release_lock`, `_read_config`, the `get`/`is-enabled`/`set`/`toggle` case statement — is identical. Make the file executable (`chmod +x`).

### Step 2 — Refactor `monitor-issues/scripts/monitor_issues.sh`

Remove the `while true` outer loop and the `sleep 5` at its end, so the script runs exactly one polling cycle and exits cleanly.

Specifically:
- Remove the `while true; do` line near the top of the main loop.
- Remove the `sleep 5` line at the bottom of the loop body.
- Remove the closing `done` of the while loop.
- Keep everything inside the loop body as-is (the SINCE/NOW_MINUS_1 logic, the gh issue list call, the per-issue processing with lock/merge/write).

The script still sources `_lib_origin.sh` and `../../_lib/tags.sh`, still sets up state dirs, still has `_acquire_lock`/`_release_lock`, still has the `trap EXIT` for lock cleanup — none of that changes.

## Files to Change

- `monitor-issues/scripts/config.sh` — create (copy + adapt from auto-fix-all's version)
- `monitor-issues/scripts/monitor_issues.sh` — remove `while true` loop and `sleep 5`

## Notes

- The `sleep 5` between cycles is now the SKILL.md's responsibility (it loops back immediately when `clear_context=false`, or after 60s via ScheduleWakeup when `clear_context=true`). In effect, `clear_context=false` gives a tighter loop (no sleep at all between cycles from the script's side); if a delay is desired, it can be added to the SKILL.md later.
- Do not change `_lib_origin.sh` or `../../_lib/tags.sh`.
