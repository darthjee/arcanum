# Node Plan: Make CLI config shortcuts take their tier from keys.json

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on `KeyRegistry#defaultTier(key)` and `ConfigChain#tierFile(repoPath, tier)` from shared. An unregistered key keeps the repo tier file. The resulting files must match the shell writers (scripter) exactly, as enforced by the parity specs.

## Implementation Steps

### Step 1 — Registry-driven target file in `NamespacedBooleanKeyConfig`

- Remove the `stateKeys` option and `this._stateKeys`.
- `_newFileForKey(repoPath, key)` becomes: `tier = registry.defaultTier(\`${namespace}.${key}\`) ?? 'repo'`; return `configChain.tierFile(repoPath, tier)`. When that is `null` (unresolvable global), throw or report a clear error. Do not silently write elsewhere, and mirror the shell writer's warning-and-skip behavior so parity holds.
- `_buildUpdate`/`_lockFile` keep using `_newFileForKey`, so the lock stays `<file>.lock` (the same lock `global_config_write` takes for the global file).
- `_readNewValue`'s unregistered-key branch keeps reading the repo file.
- Drop `stateKeys` from `AutoFixAllConfig` and `MonitorIssuesConfig` and update their JSDoc headers.

### Step 2 — Specs

Update `core/spec/lib/utils/config/NamespacedBooleanKeyConfig_spec.js`: write targets come from a stub registry (local, repo, global, unregistered → repo). Check that the `AutoFixAllConfig`/`MonitorIssuesConfig` specs and the parity specs (`core/spec/bin/autoFixAllConfigParity/*`, `core/spec/bin/monitorIssuesConfigParity/*`) still pass unchanged. Today's keys all resolve to the same files as before.

## Files to Change

- `core/lib/utils/config/NamespacedBooleanKeyConfig.js` — tier from the registry, no `stateKeys`.
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`, `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` — drop `stateKeys`.
- `core/spec/lib/utils/config/NamespacedBooleanKeyConfig_spec.js` (+ the config classes' specs if they pass `stateKeys`).

## CI Checks

- `core`: `yarn lint && yarn test` (CI jobs: `test`, `checks`)

## Notes

- Nothing in the registry routes these booleans to global today. The global branch is exercised only by specs until #907 widens their tiers.
