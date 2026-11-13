# Scripter Plan: Add a migration that deletes the legacy auto-fix-all.json and monitor-issues.json

Main plan: [plan.md](plan.md)

## Shared contracts

You produce `arcanum/migrations/repos/next/001.sh` and its manifest entry, exactly as described in [plan.md → Shared contracts](plan.md#shared-contracts): `config` prints `{"skippable": true}`, and `run` seeds, then deletes both legacy files. `node`'s spec relies on that exact behavior, including the "invalid legacy JSON → non-zero exit, nothing deleted" case.

## Implementation Steps

### Step 1 — Write the migration
- Create `arcanum/migrations/repos/next/001.sh` (executable), using the same `config` / `run` / usage shape as `arcanum/migrations/repos/0.18.0/001.sh`:
  - Source `${SCRIPT_DIR}/../../../_lib/repo_config.sh`.
  - Set `set -euo pipefail`.
  - `cmd_config` prints `{"skippable": true}`.
  - `cmd_run` calls `repo_config_seed` and then `rm -f` on both legacy paths. The seed must run first.
- Create `arcanum/migrations/repos/next/001.md`. It is the human-readable summary shown by `/arcanum-migrate` and should explain:
  - Why: since #902–#904, nothing reads these files any more.
  - Why it seeds first: so a repo that never ran `0.9.3/001` or `0.18.0/001` loses nothing.
  - Why disagreeing files are safe: the namespaced value already wins.
  - Why it is skippable: a declining repo just keeps inert files.
  - That the deletion shows up as an uncommitted change for the user to commit.
  - That it is safe to re-run.
- Fill `arcanum/migrations/repos/next/migrations.json` with the single entry from the shared contract.

### Step 2 — Point the docs at the migration
Replace the "#906 deletes them" wording with a reference to `arcanum/migrations/repos/next/001.sh`. Use the full file path, never the bare `next/` folder, so `scripts/bump-version.sh` rewrites it on release; see `docs/agents/architecture/per-repo-migrations.md` → "Referencing pending migrations". Two places:
- `docs/agents/architecture/shared-state-and-configuration.md` (the `arcanum-repo-config.json` row).
- `docs/agents/architecture/config-keys.md` (around line 28).

## Files to Change
- `arcanum/migrations/repos/next/001.sh` — new migration script.
- `arcanum/migrations/repos/next/001.md` — new migration summary.
- `arcanum/migrations/repos/next/migrations.json` — add the `001` entry.
- `docs/agents/architecture/shared-state-and-configuration.md` — reference the migration.
- `docs/agents/architecture/config-keys.md` — reference the migration.

## CI Checks
- `shellcheck arcanum/migrations/repos/next/001.sh`
- The `core/` spec suite (`make core-test` or `cd core && yarn test`) runs `node`'s spec against this script.

## Notes
- Do not touch `repo_config.sh`. Its `<legacy_file>` parameter is still needed by migrations, including this one.
