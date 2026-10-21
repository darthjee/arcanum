# Node Plan: Consolidate monitor-issues clear_context into the shared configuration

Main plan: [plan.md](plan.md)

## Shared contracts

- Namespace `monitor-issues`. `clear_context` → `.claude/state/arcanum-config.json`, with no legacy file (`null`). Any other key → `.claude/configuration/arcanum-repo-config.json`, with legacy `.claude/configuration/monitor-issues.json`. Paths resolve under `repoPath` (the shim's `$PWD`).
- The output must be byte-identical to the reworked shell scripts (`repo_config_read`/`repo_config_write` semantics, `jq -c` values, `false` when absent), as `AutoFixAllConfig` already does.
- The lock is `<new file>.lock`.
- Registry entry: `monitor-issues.clear_context`, boolean, `tiers: ["local"]`, `default: false`, description "Clear the context between monitor-issues polling cycles", with no `setup`.
- `scripter` delivers `arcanum/migrations/repos/next/001.sh` (`config` → `{"skippable": false}`; `run` seeds via `repo_config_seed`). You write its contract spec.

## Implementation Steps

### Step 1 — Rework MonitorIssuesConfig and its specs

Rewrite `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` to match `AutoFixAllConfig.js`. Use `NAMESPACE = 'monitor-issues'` and `STATE_KEYS = new Set(['clear_context'])`, and add `_newFileForKey`/`_legacyFileForKey`. `_lockFile` becomes `<new file>.lock`. `_readValue` reads the namespace section first, then falls back to the legacy file (never for `clear_context`), and returns `JSON.stringify` output. `_buildUpdate` seeds from the legacy file when the namespace is absent. Drop the `JsonValueFormatter` dependency if nothing else needs it. The duplication between the two classes is acceptable, but if a small shared base (e.g. a `NamespacedBooleanKeyConfig` parameterised by namespace, state keys and legacy file) reads cleaner, factor it out and make both classes use it.

Update `core/spec/lib/commands/monitor-issues/MonitorIssuesConfig_spec.js`, the parity spec `core/spec/bin/monitorIssuesConfigParity/config_spec.js`, `core/spec/bin/monitorIssuesEngineDispatch_spec.js` and `core/spec/docker/monitorIssues_spec.js` so they assert the new file locations and shape: the state key under `.monitor-issues.clear_context`, no legacy read for `clear_context`, and legacy fallback and seed for other keys. Check `core/spec/lib/core/commands_spec.js` too; the command routing doesn't change.

### Step 2 — Register the key and spec the migration

Add the `monitor-issues.clear_context` entry to `core/lib/utils/config/keys.json`, next to the `auto-fix-all.*` entries. Make sure the registry specs (`keys_spec.js`, `KeyRegistry_spec.js`, `KeyRegistryDefaults_spec.js`, `ShellConfigKeyScan_spec.js`) pass with the new shell annotations.

Add a contract spec for the migration, e.g. `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js`. Name the script with one full string literal, `path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh')`, per the spec convention in `docs/agents/architecture/per-repo-migrations.md`. Cover: `config` prints `{"skippable": false}`; `run` seeds `{"monitor-issues": {"clear_context": true}}` into `.claude/state/arcanum-config.json` from a legacy file while preserving other top-level keys; `run` is a no-op when the namespace already exists or the legacy file is absent; the legacy file is not deleted; an unknown subcommand exits 1.

## Files to Change

- `core/lib/commands/monitor-issues/MonitorIssuesConfig.js`: namespaced layout
- `core/lib/utils/config/` (optional): shared namespaced base class, if extracted
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` (optional): only if it moves to that shared base
- `core/spec/lib/commands/monitor-issues/MonitorIssuesConfig_spec.js`: new paths and shape
- `core/spec/bin/monitorIssuesConfigParity/config_spec.js`: new paths and shape
- `core/spec/bin/monitorIssuesEngineDispatch_spec.js`, `core/spec/docker/monitorIssues_spec.js`: new paths, if asserted
- `core/lib/utils/config/keys.json`: new registry entry
- `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js`: new migration contract spec

## CI Checks

- `core`: `make core-test` (CI job: `test`) and `make core-lint` (CI job: `checks`)
- Optional: `make docker-parity`, for the docker-engine specs

## Notes

- The parity spec runs both engines, so it depends on `scripter`'s shell rework landing in the same branch.
