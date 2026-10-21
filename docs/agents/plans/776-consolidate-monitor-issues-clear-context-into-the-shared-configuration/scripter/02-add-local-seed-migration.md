# Add the local seed migration

Add a per-repo migration that copies an existing per-clone `clear_context` value from `.claude/state/monitor-issues-config.json` into the `monitor-issues` namespace of `.claude/state/arcanum-config.json`. Follow the shape of `arcanum/migrations/repos/0.18.0/001.sh`/`001.md`:

- `001.sh config` prints `{"skippable": false}`. `001.sh run` calls `repo_config_seed ".claude/state/arcanum-config.json" ".claude/state/monitor-issues-config.json" monitor-issues`. Any other argument prints usage and exits 1.
- `001.md` gives a human-readable summary. It explains why the migration is non-skippable (the runtime no longer reads the legacy file for `clear_context`), that it is idempotent, and that the legacy file and `monitor-issues-config.lock` are left in place.
- Append `{"id": "001", "type": "script", "file": "001.sh", "skippable": false, "applies_to": "local"}` to `arcanum/migrations/repos/next/migrations.json`.

If `next/` already has entries when this step runs, use the next free id, and use that id everywhere this plan says `001`.

## Files to Change

- `arcanum/migrations/repos/next/001.sh`: new, seeds the local `monitor-issues` namespace
- `arcanum/migrations/repos/next/001.md`: new, the migration summary
- `arcanum/migrations/repos/next/migrations.json`: register the entry
