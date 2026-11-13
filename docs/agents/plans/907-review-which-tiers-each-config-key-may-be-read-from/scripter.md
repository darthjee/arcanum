# Scripter Plan: Review which tiers each config key may be read from

Main plan: [plan.md](plan.md)

## Shared contracts

Produce exactly the migration contract in the main plan: entries `002` (`applies_to: "global"`) and `003` (`applies_to: "local"`) in `arcanum/migrations/repos/next/migrations.json`, with `config`/`run` subcommands, warn-only, writing to stderr with the given wording, exit 0, never modifying any file. node's contract spec asserts on that.

## Implementation Steps

### Step 1 — Global warn-only migration `002`

Add `arcanum/migrations/repos/next/002.sh` + `002.md`, modelled on `next/001.sh` (header, `set -euo pipefail`, `cmd_config`, `cmd_run`, usage case) and on the global-scoped `2.3.0/001.sh`. Source `arcanum/_lib/global_config.sh` and use its reader (`global_config_read`, or `_global_config_file` + `jq`) to look up `git.safe_branch`, `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context` (the nested paths `.git.safe_branch`, `.["auto-fix-all"].clear_context`, …). Print one warning per present, non-null value. A missing file, an unresolvable location or no matches print nothing. A malformed file prints a single warning. Always exit 0.

`002.md`: what it reports and why. #907 widened these keys to the global tier, so a global value that used to be ignored now applies. It changes nothing.

### Step 2 — Local warn-only migration `003` and manifest

Add `003.sh` + `003.md` for `auto-fix-all.ignored_check_patterns` in `.claude/state/arcanum-config.json` (relative to cwd = target repo, as `001.sh` does), warning that the local value now overrides the repo value. Append both entries to `next/migrations.json` after `001`.

## Files to Change
- `arcanum/migrations/repos/next/002.sh`, `002.md` — new global warn-only migration.
- `arcanum/migrations/repos/next/003.sh`, `003.md` — new local warn-only migration.
- `arcanum/migrations/repos/next/migrations.json` — two new entries.

## CI Checks
- `core` (the migration's contract spec lives in `core/spec/bin/`): `make core-check` (CI jobs: `test`, `checks`)

## Notes
- The scripts are shell only, with no native counterpart, like `next/001.sh`. `scripts/bump-version.sh` renames `next/` on release, so keep paths relative to `SCRIPT_DIR`.
- Keep the deterministic logic in the script; the `.md` files are human summaries only.
