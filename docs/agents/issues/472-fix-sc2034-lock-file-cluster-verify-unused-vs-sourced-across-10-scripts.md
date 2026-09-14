# Issue: Fix SC2034 LOCK_FILE cluster: verify unused vs. sourced across 10 scripts

## Description
Part of #464 (Sweep unused shell variables flagged by ShellCheck SC2034). Codacy's ShellCheck flags `LOCK_FILE` as an unused assignment (SC2034) in 10 files. In each of these, `LOCK_FILE` is set only so that a file which `source`s the script later can read it — ShellCheck analyzes each file in isolation and can't see that cross-file usage.

## Problem
A naive "delete the line" fix would break any sourcing caller that actually reads `LOCK_FILE` after sourcing one of these files. Each occurrence needs to be checked individually against its real sourcing callers before deciding between removal and a documented suppression.

## Expected Behavior
- All 10 `LOCK_FILE` SC2034 findings below are resolved (removed or suppressed with a comment naming the consumer).
- No existing script behavior changes.
- Re-running ShellCheck/Codacy on the affected files shows zero SC2034 findings among these 10 locations.

## Solution
For each of the following `file:line` locations, verify whether `LOCK_FILE` is read by a caller that `source`s the file:

- `auto-fix-all/scripts/queue_common.sh:13`
- `monitor-issues/scripts/config.sh:12`
- `monitor-issues/scripts/monitor_issues.sh:34`
- `monitor-issues/scripts/rewrite_queue.sh:36`
- `arcanum/migrations/_ledger.sh:61`
- `arcanum/migrations/run.sh:194`
- `arcanum/migrations/update_per_file.sh:239`
- `arcanum/_lib/repo_config.sh:160`
- `arcanum/_lib/global_config.sh:112`
- `arcanum/_lib/permission_grant_shell.sh:62`

For each: if genuinely unused, remove the assignment; if consumed by a sourcing caller, keep it and add `# shellcheck disable=SC2034` with a comment naming that consumer.

Work should be delegated to the `scripter` agent, since all affected files are under `<skill>/scripts/` or `arcanum/_lib/`.

## Benefits
- Clears 10 of the 24 outstanding Codacy/ShellCheck SC2034 findings tracked by #464, in an independently reviewable PR.
- Documents intent for cross-file variables via `# shellcheck disable=SC2034` comments naming their consumer, reducing future confusion about why a seemingly-unused assignment exists.
