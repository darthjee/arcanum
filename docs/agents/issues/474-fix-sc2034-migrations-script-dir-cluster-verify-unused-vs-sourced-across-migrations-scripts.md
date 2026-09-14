# Issue: Fix SC2034 MIGRATIONS_SCRIPT_DIR cluster: verify unused vs. sourced across migrations scripts

## Description

Part of #464 (Sweep unused shell variables flagged by ShellCheck SC2034). Codacy's ShellCheck flags `MIGRATIONS_SCRIPT_DIR` as an unused assignment (SC2034) in 3 `arcanum/migrations` scripts. In each, it is set only so that a file which `source`s the script later can read it — ShellCheck analyzes each file in isolation and can't see this cross-file usage.

## Problem

A naive "delete the line" fix would break any sourcing caller that actually reads `MIGRATIONS_SCRIPT_DIR`. Each occurrence needs to be checked individually against its real sourcing callers before deciding between removal and a documented suppression.

## Expected Behavior

- All 3 `MIGRATIONS_SCRIPT_DIR` SC2034 findings below are resolved (removed or suppressed with a comment naming the consumer).
- No existing script behavior changes.
- Re-running ShellCheck/Codacy on the affected files shows zero SC2034 findings among these 3 locations, with no newly introduced warnings.

## Solution

Investigation (grep across the repo for `MIGRATIONS_SCRIPT_DIR`) confirms all 3 occurrences are genuinely consumed, not dead — each sets `MIGRATIONS_SCRIPT_DIR` right before sourcing `_pending_versions.sh`, which reads it (`source "${MIGRATIONS_SCRIPT_DIR}/_manifest.sh"` and the `for dir in "${MIGRATIONS_SCRIPT_DIR}"/repos/*/` loop):

- `arcanum/migrations/update_per_version.sh:94` — consumed by `_pending_versions.sh` (sourced at line 103)
- `arcanum/migrations/run.sh:91` — consumed by `_pending_versions.sh` (sourced at line 100)
- `arcanum/migrations/select_version.sh:38` — consumed by `_pending_versions.sh` (sourced at line 45)

For each of the 3: keep the assignment and add `# shellcheck disable=SC2034` immediately above it, with a comment naming `_pending_versions.sh` as the consumer — none should be removed.

Work should be delegated to the `scripter` agent, since all affected files are under `arcanum/migrations/`.

## Benefits

- Clears the `MIGRATIONS_SCRIPT_DIR` cluster of Codacy/ShellCheck SC2034 findings tracked by #464.
- Documents the cross-file sourcing relationship in-line, reducing future confusion about why the assignment looks unused.
