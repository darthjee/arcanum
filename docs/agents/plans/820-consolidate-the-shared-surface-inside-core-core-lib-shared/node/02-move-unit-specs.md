# Move the unit specs

Follow the [Spec-file inventory](../../../specs/shared-lib.md#spec-file-inventory); do not re-derive it.

- **Moved** → `core/spec/lib/shared/{config,file}/` via `git mv`: `AgentEmail_spec.js`, `ConfigChain_spec.js`, `ConfigError_spec.js`, `KeyRegistry_spec.js`, `keys_spec.js`, `RepoConfig_spec.js`, `RepoConfigWriter_spec.js`, `LockTimeoutError_spec.js`, `RepoPath_spec.js`.
- `Lock_spec.js` (listed as *duplicated*) moves **whole** to `core/spec/lib/shared/file/Lock_spec.js`, unchanged apart from imports. Splitting it is #822's job.
- **Stays in core**, imports only: `core/spec/lib/utils/config/{KeyRegistryDefaults,ShellConfigKeyScan,BooleanKeyConfig,NamespacedBooleanKeyConfig}_spec.js`, `core/spec/bin/agentEmailParity_spec.js`, `core/spec/support/utils/shellConfigKeys.js`, `core/spec/support/strictConfigKeys.js`.
- Every other spec and support file that imports a moved path (`core/spec/bin/**`, `core/spec/docker/**`, `core/spec/lib/commands/**`, `core/spec/lib/services/**`, `core/spec/support/{dummies,factories,fixtures,sharedExamples}/**`) gets new import paths only.

Moved specs sit one directory deeper-or-equal than before; recheck every `../` count, including `keys_spec.js`'s `KEYS_FILE` path and support imports (`tempDir`, `gitFixtureRepo`, `agentEmailFixtures`, `repoContextFactory`). Update the expected strict-mode message in `KeyRegistry_spec.js` to the new `keys.json` path, and any comment naming the old path (e.g. `ShellConfigKeyScan_spec.js`'s header).

## Files to Change
- `core/spec/lib/utils/config/*_spec.js`, `core/spec/lib/utils/file/{Lock,LockTimeoutError,RepoPath}_spec.js` — moved per the inventory
- remaining `core/spec/**` importers — import paths only
