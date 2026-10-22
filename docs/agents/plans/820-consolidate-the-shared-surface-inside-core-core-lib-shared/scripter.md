# Scripter Plan: Consolidate the shared surface inside core (core/lib/shared/)

Main plan: [plan.md](plan.md)

## Shared contracts

`node` moves `Lock.js` to `core/lib/shared/file/Lock.js`. Nothing you change is consumed by another agent.

## Implementation Steps

### Step 1 — Repoint the lock.sh comment

The header of `arcanum/_lib/lock.sh` says the protocol is "shared byte-for-byte with core/lib/utils/file/Lock.js". Change the path to `core/lib/shared/file/Lock.js`. Comment only; no behaviour change. (#824 repoints it again to `shared/lib/file/Lock.js`.)

## Files to Change
- `arcanum/_lib/lock.sh` — header comment path

## Notes
- No other script under `arcanum/_lib/` or `<skill>/scripts/` names a moved path.
