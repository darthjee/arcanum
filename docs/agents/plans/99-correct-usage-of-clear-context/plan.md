# Plan: Correct usage of clear context

Issue: [99-correct-usage-of-clear-context.md](../issues/99-correct-usage-of-clear-context.md)

## Overview
Move the `clear_context` toggle for both `auto-fix-all` and `monitor-issues` out of their committed `.claude/configuration/*.json` files and into new, gitignored `.claude/state/*-config.json` files, while every other key (currently just `ignored_check_patterns`) stays in the committed configuration file. Both skills' `config.sh` scripts already share an identical shape, so the fix is the same edit applied twice.

## Context
`.claude/configuration/` is committed to the repo and meant for stable, shared settings. `clear_context` is a personal, frequently-toggled run-time preference (flipped via `/toggle-clear-context` and `/toggle-monitor-clear-context`), so storing it there risks it being swept into unrelated commits and mixes volatile state with stable config. `.claude/state/` is already gitignored and already used for other per-checkout runtime state (e.g. the `auto-fix-all-queue.json` and per-issue files), and both scripts already point their lock files there (`.claude/state/auto-fix-all-config.lock`, `.claude/state/monitor-issues-config.lock`), so this is a natural home.

## Implementation Steps

### Step 1 — Route `clear_context` to state in `auto-fix-all/scripts/config.sh`
Add a second file path, `.claude/state/auto-fix-all-config.json`, alongside the existing `CONFIG_FILE=".claude/configuration/auto-fix-all.json"`. Introduce a small helper (e.g. `_config_file_for_key <key>`) that returns the state file path when `key == "clear_context"` and the configuration file path otherwise. Update `_read_config` to accept a file path argument instead of hardcoding `CONFIG_FILE`. In each of the `get`, `is-enabled`, `set`, and `toggle` cases, resolve the target file via the helper before reading/writing, and write back to that same resolved file (both the read and the write in a given invocation must target the same file). `LOCK_FILE` already lives in `.claude/state/` and needs no change — it can continue to guard writes to either file.

### Step 2 — Apply the same change to `monitor-issues/scripts/config.sh`
Mirror Step 1 exactly, using `.claude/state/monitor-issues-config.json` as the new state file and `.claude/configuration/monitor-issues.json` as the existing (currently not-yet-created-on-disk, but still the intended) configuration file for any non-`clear_context` key.

### Step 3 — Update the architecture doc
In `docs/agents/architecture.md`'s "Shared State & Configuration Files" table, add rows for `.claude/state/auto-fix-all-config.json` and `.claude/state/monitor-issues-config.json` (schema: `{"clear_context": true|false}`), and adjust the existing `.claude/configuration/auto-fix-all.json` row's description to clarify it no longer holds `clear_context`.

## Files to Change
- `auto-fix-all/scripts/config.sh` — route `clear_context` reads/writes to `.claude/state/auto-fix-all-config.json`; all other keys keep using `.claude/configuration/auto-fix-all.json`.
- `monitor-issues/scripts/config.sh` — same routing, using `.claude/state/monitor-issues-config.json` and `.claude/configuration/monitor-issues.json`.
- `docs/agents/architecture.md` — document the two new state files in the Shared State & Configuration Files table.

## Notes
- `toggle-clear-context`, `toggle-monitor-clear-context`, and the `auto-fix-all`/`monitor-issues` SKILL.md docs all call `config.sh` by key name only (`config.sh toggle clear_context`, `config.sh is-enabled clear_context`) and need no changes — the routing is internal to `config.sh`.
- No data migration is needed: neither `.claude/configuration/auto-fix-all.json` nor a `monitor-issues.json` equivalent currently has a committed `clear_context` value on disk, so there's nothing to carry over.
- No test suite or CI config exists in this repo (markdown/bash skills project) — verification is manual: exercise `get`/`is-enabled`/`set`/`toggle` for both `clear_context` and a non-`clear_context` key (e.g. `ignored_check_patterns`) on both scripts, confirming each lands in the right file.
