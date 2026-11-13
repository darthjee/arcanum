# Issue: Add a migration that deletes the legacy auto-fix-all.json and monitor-issues.json

## Description
Part of #900. Owner: `scripter`.

Add a per-repo migration, `arcanum/migrations/repos/next/001.sh` (with `001.md` and a `next/migrations.json` entry, `applies_to: "repo"`), that removes the legacy `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json`.

## Problem
Since #902–#904, no reader or writer touches these two files any more: no read fallback, no seed on write, no warning. Repos still carry them as committed dead files. They can also disagree with the real value (e.g. `["codacy"]` vs. `["Codacy"]`), which confuses anyone reading the repo config.

## Expected Behavior
After `/arcanum-migrate` runs this migration on a repo:
- `.claude/configuration/arcanum-repo-config.json` has an `auto-fix-all` namespace. If it was missing, it was seeded from the legacy `auto-fix-all.json` first, so no value is lost.
- `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json` no longer exist. `.claude/configuration/` itself stays.
- The deletions show up as uncommitted changes for the user to commit.
- Re-running it is a no-op: missing files are fine, and seeding does nothing when the namespace already exists.

## Solution
- `001.sh` follows the `config` / `run` shape of `arcanum/migrations/repos/0.18.0/001.sh`.
- `run`: call `repo_config_seed ".claude/configuration/arcanum-repo-config.json" ".claude/configuration/auto-fix-all.json" auto-fix-all`, then `rm -f` both legacy files.
- `monitor-issues.json` is deleted without seeding: no registered key reads it.
- When the two files disagree, the namespaced value already wins, so deleting the legacy file changes no behavior.
- `config` returns `{"skippable": true}`: deleting committed files is intrusive, and a repo that declines just keeps inert files nothing reads.
- Follow `docs/agents/architecture/per-repo-migrations.md`, including "Referencing pending migrations". Any doc or spec cites `arcanum/migrations/repos/next/001.sh` by its full literal path, never the bare `next/` folder.
- Add a spec under `core/spec/bin/` covering: seed then delete, namespace already present (no overwrite, file still deleted), only one or neither legacy file present, and idempotent re-run.
- Update `docs/agents/architecture/shared-state-and-configuration.md` and `docs/agents/architecture/config-keys.md` so they point at the migration instead of saying "#906 deletes them".

Dependency: the fallback removal (#904) has already merged, so this can ship any time.

## Benefits
Repos lose two dead config files that could disagree with the real settings, and the configuration has a single source of truth.
