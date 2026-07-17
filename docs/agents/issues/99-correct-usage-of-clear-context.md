# Issue: Correct usage of clear context

## Description
Both the `auto-fix-all` and `monitor-issues` skills store their `clear_context` setting inside their committed configuration files — `.claude/configuration/auto-fix-all.json` (alongside `ignored_check_patterns`) and `.claude/configuration/monitor-issues.json` respectively.

## Problem
`.claude/configuration/` is committed to the repository and meant for stable, shared settings like `ignored_check_patterns`. `clear_context`, by contrast, is a run-time toggle that individual users flip frequently via `/toggle-clear-context` and `/toggle-monitor-clear-context` to control whether these skills clear their conversation context between loop iterations. Storing it in a committed file risks it being accidentally committed as part of unrelated changes, and mixes a volatile personal preference with stable shared config.

## Expected Behavior
For both skills, `clear_context` is read from and written to a per-checkout, gitignored state file — `.claude/state/auto-fix-all-config.json` for `auto-fix-all` and `.claude/state/monitor-issues-config.json` for `monitor-issues` — while `ignored_check_patterns` remains in `.claude/configuration/auto-fix-all.json` (committed, shared). Only `clear_context` moves — no other keys.

## Solution
Update `auto-fix-all/scripts/config.sh` and `monitor-issues/scripts/config.sh` so that `get`/`is-enabled`/`set`/`toggle` route `clear_context` to the new state file while all other keys continue to use the existing configuration file. Update `docs/agents/architecture.md`'s Shared State & Configuration Files table to document the two new state files. The `toggle-clear-context` and `toggle-monitor-clear-context` skills, and the `auto-fix-all`/`monitor-issues` SKILL.md docs, should continue to work unchanged since they call `config.sh` by key name.

## Benefits
Keeps the committed, shared configuration files free of personal/local run-time toggles, avoids accidental commits of `clear_context` state, and reinforces the existing convention that `.claude/state/` holds frequently-changing, per-checkout data while `.claude/configuration/` holds stable shared settings. Applying the fix to both skills now avoids leaving an inconsistent pattern for a later issue to clean up.
