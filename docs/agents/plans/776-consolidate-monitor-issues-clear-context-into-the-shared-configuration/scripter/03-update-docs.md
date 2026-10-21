# Update the docs

- `docs/agents/architecture/shared-state-and-configuration.md`: mark the `.claude/state/monitor-issues-config.json` row as legacy/obsolete. It is no longer read, its value is seeded forward by `arcanum/migrations/repos/next/001.sh`, and the file is left in place. Document `monitor-issues.clear_context` wherever `.claude/state/arcanum-config.json`'s namespaces are listed, and mention that `.claude/state/monitor-issues-config.lock` is no longer used.
- `docs/guides/arcanum-repo-config.md`: wherever it lists the `auto-fix-all` new/legacy split, add the `monitor-issues` namespace and its legacy files the same way.
- `docs/agents/specs/arcanum-cli/key-registry.md` and `docs/agents/specs/arcanum-cli.md` / `shortcuts-and-setup.md`: change the "added together with #776 only" / "becomes available only after #776" wording so it states the key is now registered.
- `docs/agents/architecture/entrypoint-migration-status.md`: check its `monitor-issues-config-*` mentions and update any that describe the old files.
- `README.md`: update any mention of `monitor-issues-config.json`.

Cite the migration as `arcanum/migrations/repos/next/001.sh` (with the real id) so `scripts/bump-version.sh` can rewrite it on release.

## Files to Change

- `docs/agents/architecture/shared-state-and-configuration.md`: new key location, legacy file marked obsolete
- `docs/guides/arcanum-repo-config.md`: `monitor-issues` namespace
- `docs/agents/specs/arcanum-cli/key-registry.md`: drop the "#776 only" note
- `docs/agents/specs/arcanum-cli.md`, `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`: wording, if it still reads as future work
- `docs/agents/architecture/entrypoint-migration-status.md`, `README.md`: only if they describe the old files
