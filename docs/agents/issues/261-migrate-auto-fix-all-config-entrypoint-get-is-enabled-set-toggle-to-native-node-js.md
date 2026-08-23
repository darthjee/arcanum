# Issue: Migrate auto-fix-all-config entrypoint (get, is-enabled, set, toggle) to native Node.js

## Description

Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

### Source script

`auto-fix-all/scripts/config.sh`

Config management for auto-fix-all, with 4 subcommands: `get <key>`, `is-enabled <key>`, `set <key> true|false`, `toggle <key>`. Reads/writes through `arcanum/_lib/repo_config.sh`'s new/legacy file split (`clear_context`/`finish_on_empty_queue` live in the gitignored state file with no legacy fallback; every other key lives in the committed repo config with a legacy fallback).

### External dependencies

None — pure local JSON file read/write via `arcanum/_lib/repo_config.sh` (not yet migrated; re-derive the new/legacy file resolution and namespace read/write logic natively). No GitHub API calls.

### Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.

## Solution

Follow `docs/agents/architecture/script-engine.md` — this script has multiple subcommands, so it migrates to **one module with multiple methods**, one `COMMANDS` entry per subcommand (same precedent as `github-issue-create`/`github-issue-info` both mapping to `GithubIssue.js`):

1. Read `auto-fix-all/scripts/config.sh` for its exact output/exit-code contract (all 4 subcommands).
2. Create `core/lib/AutoFixAllConfig.js` (zero runtime deps, built-in Node APIs only) with methods `get`, `isEnabled`, `set`, `toggle`.
3. Register in `core/bin/arcanum`'s `COMMANDS` map:
   - `'auto-fix-all-config-get': { module: 'AutoFixAllConfig.js', method: 'get' }`
   - `'auto-fix-all-config-is-enabled': { module: 'AutoFixAllConfig.js', method: 'isEnabled' }`
   - `'auto-fix-all-config-set': { module: 'AutoFixAllConfig.js', method: 'set' }`
   - `'auto-fix-all-config-toggle': { module: 'AutoFixAllConfig.js', method: 'toggle' }`
4. Add `"auto-fix-all-config": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/AutoFixAllConfig_spec.js`, covering all 4 subcommands.
6. Write parity tests (shell vs. native, identical stdout/exit code) for each subcommand.
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.
