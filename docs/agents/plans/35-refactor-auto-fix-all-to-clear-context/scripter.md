# Scripter Plan: Refactor Auto-Fix-All to Clear Context

Main plan: [plan.md](plan.md)

## Shared contracts

- Script location: `auto-fix-all/scripts/config.sh`
- Interface: `config.sh get <key>` → prints `"true"` or `"false"`; `config.sh set <key> <value>`; `config.sh toggle <key>` → prints new value
- Config file: `.claude/configuration/auto-fix-all.json` (already exists)
- New field: `"clear_context": false` (boolean; treated as false when absent)
- Lock file for mutations: `.claude/state/auto-fix-all-config.lock` (same acquire/retry/release pattern as `queue.sh`)

## Implementation Steps

### Step 1 — Create `auto-fix-all/scripts/config.sh`

New script with the following commands:

**`get <key>`**
- Read `.claude/configuration/auto-fix-all.json` with `jq -r --arg k "<key>" '.[$k] // false'`.
- Print `true` or `false` to stdout.
- No lock needed (read-only).

**`set <key> <value>`**
- Acquire lock (`.claude/state/auto-fix-all-config.lock`), same pattern as `queue.sh`:
  - Write instance ID to lock file, sleep 1s, re-read — if match, lock held; else retry.
  - Warn once after 10 failed attempts.
- Read config JSON (or `{}` if file missing/empty).
- Merge: `jq --arg k "<key>" --arg v "<value>" '.[$k] = ($v == "true")'`
  - (Store as JSON boolean, not string.)
- Write atomically: `> .tmp`, then `mv .tmp`.
- Release lock.

**`toggle <key>`**
- Acquire lock.
- Read current value via `jq -r --arg k "<key>" '.[$k] // false'`.
- Flip: if `true` → `false`, if `false` → `true`.
- Write atomically (same as set).
- Release lock.
- Print new value (`true` or `false`) to stdout.

Header:
```bash
#!/usr/bin/env bash
# Config management for auto-fix-all.
# Usage: config.sh get <key>
#        config.sh set <key> true|false
#        config.sh toggle <key>
set -euo pipefail
CONFIG_FILE=".claude/configuration/auto-fix-all.json"
LOCK_FILE=".claude/state/auto-fix-all-config.lock"
STATE_DIR=".claude/state"
mkdir -p "$STATE_DIR"
```

The `_acquire_lock` / `_release_lock` functions are identical to those in `queue.sh` — copy them verbatim rather than sourcing (each script is self-contained).

## Files to Change

- `auto-fix-all/scripts/config.sh` — create new config management script (chmod +x)

## Notes

- The `set` command stores booleans as JSON booleans (`true`/`false`), not strings. `get` outputs the shell string `"true"` or `"false"` via jq's `-r` flag.
- No changes to `queue.sh` — config is a separate concern with its own lock file.
- The script does not create the config file on first use — `get` returns `false` for missing keys, and `set`/`toggle` will create the file if absent (using `{}` as the starting JSON).
