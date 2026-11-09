# Read NamespacedBooleanKeyConfig values through ConfigChain

`NamespacedBooleanKeyConfig#_readValue` currently reads `_newFileForKey(repoPath, key)` directly and checks it with `hasOwnProperty`. Change it to:

1. `const value = await this._configChain.read(repoPath, this._namespace, key)`. `ConfigChain` picks the tier(s) from `keys.json` (local for `auto-fix-all.clear_context`/`finish_on_empty_queue` and `monitor-issues.clear_context`). If `value !== undefined`, return `JSON.stringify(value)`.
2. Otherwise keep the existing legacy-file fallback (`_legacyFileForKey`) unchanged. #904 removes it.

Add a `configChain` option to the constructor (default `new ConfigChain()`) and pass it through `AutoFixAllConfig` and `MonitorIssuesConfig` so specs can inject one.

Leave the write side (`_buildUpdate`, `_newFileForKey` for writes, `_lockFile`, `stateKeys`) untouched: #905 owns it. `_newFileForKey` stays because writes and the lock use it.

Behavior change, which is intended: an explicit `null` in the new file now falls through to the legacy file or the default, instead of reading as `"null"`. Add a spec for it.

Spec cases:

- a state key set only in the repo or global config → `undefined` / not enabled;
- a state key set locally → as today;
- `null` falls through;
- `false` stops the chain;
- the legacy fallback still works for a repo-tier key.

## Files to Change

- `core/lib/utils/config/NamespacedBooleanKeyConfig.js`: `_readValue` through `ConfigChain`, `configChain` constructor option, JSDoc.
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`, `core/lib/commands/monitor-issues/MonitorIssuesConfig.js`: pass the optional `configChain` through.
- `core/spec/lib/utils/config/NamespacedBooleanKeyConfig_spec.js`, `core/spec/lib/commands/monitor-issues/MonitorIssuesConfig_spec.js` and the `AutoFixAllConfig` spec: the new cases.
- `core/spec/bin/autoFixAllConfigParity/`, `core/spec/bin/monitorIssuesConfigParity/`: only if a `null` case now diverges (see the node plan notes).
