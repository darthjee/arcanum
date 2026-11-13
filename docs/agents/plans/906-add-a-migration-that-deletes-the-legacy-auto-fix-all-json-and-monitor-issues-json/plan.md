# Plan: Add a migration that deletes the legacy auto-fix-all.json and monitor-issues.json

Issue: [906-add-a-migration-that-deletes-the-legacy-auto-fix-all-json-and-monitor-issues-json.md](../../issues/906-add-a-migration-that-deletes-the-legacy-auto-fix-all-json-and-monitor-issues-json.md)

## Overview
Add a skippable per-repo migration, `arcanum/migrations/repos/next/001.sh`. It seeds the `auto-fix-all` namespace of the committed repo config from the legacy `.claude/configuration/auto-fix-all.json` (only if the namespace is missing), then deletes that file and `.claude/configuration/monitor-issues.json`. `scripter` writes the migration and updates the docs. `node` adds a contract spec under `core/spec/bin/`.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Script:** `arcanum/migrations/repos/next/001.sh`, run with cwd = the target repo root.
- **Manifest entry** in `arcanum/migrations/repos/next/migrations.json` (currently `[]`): `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "repo"}`.
- **`001.sh config`:** prints exactly `{"skippable": true}` followed by a newline, and exits 0.
- **`001.sh run`:**
  1. Calls `repo_config_seed ".claude/configuration/arcanum-repo-config.json" ".claude/configuration/auto-fix-all.json" auto-fix-all`. This is a no-op when the namespace already exists or the legacy file is absent. Other top-level keys are preserved.
  2. Runs `rm -f` on `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json`.
  3. Leaves `.claude/configuration/` in place and exits 0.
  - If neither legacy file exists, it creates nothing; in particular it does not create `arcanum-repo-config.json`.
  - If the legacy `auto-fix-all.json` is invalid JSON, the seed's `jq --slurpfile` fails. Under `set -euo pipefail` the script then exits non-zero **before** deleting anything, so no data is lost.
- **Any other subcommand:** prints usage to stderr and exits 1.
