# Node Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You **produce** C1 (see [plan.md](plan.md#c1--native-command-arcanum-check-config)) exactly as specified: command name, registry entry, argument shape, JSON output shape, usage error and exit codes. You can rely on the scripter's shim (C3) invoking `core/bin/arcanum arcanum-check-config <repo_path> <key>` with `HOME` and `CLAUDE_CONFIG_DIR` forwarded.

## Implementation Steps

### Step 1 — Per-tier read in `ConfigChain`
Add a public, origin-aware method to `core/lib/utils/config/ConfigChain.js`, e.g. `async readTiers(repoPath, namespace, key)`. It returns the three tiers in precedence order as `[{ tier: 'local'|'repo'|'global', file, set, value? }]`, using `_tierFiles()`, `_readJson()` and `_resolveKey()`. The same present-and-non-null rule applies, with `""` counting as set. `key` may be empty or undefined, in which case the tier's whole namespace section is the value.

Don't duplicate the resolution rule. Factor the per-tier "present and non-null" lookup into one private helper that both `read()` and `readTiers()` use. `read()`'s behavior and JSDoc contract stay unchanged (including multi-key-per-tier ordering and the `repoContext` fallback).

Extend `core/spec/lib/utils/config/ConfigChain_spec.js`:
- all tiers set (shadowing is visible);
- only the global tier set;
- none set;
- a `null` value treated as not set;
- `""` treated as set;
- missing and malformed files;
- global path `null` when `HOME` and `CLAUDE_CONFIG_DIR` are unset;
- a namespace-only key;
- object and array values returned as subtrees;
- existing `read()` specs still pass unchanged.

### Step 2 — `ArcanumCheckConfig` command and registration
Create `core/lib/commands/arcanum-check-config/ArcanumCheckConfig.js`. It is constructed with a `RepoContext` (context `'repo'`) and has an injectable `ConfigChain` / stdout writer for tests, following the existing command classes' patterns.

`run(key)`:
1. Validate `key`. If it's missing or empty, throw `DispatchFailure` with the usage line on stderr and exit 1, following whichever pattern existing commands use to emit stderr.
2. Split `key` into the namespace and the rest.
3. Call `readTiers`.
4. Build the C1 object (`key`, `local`, `repo`, `global`, `final`) and print it with `JSON.stringify(obj, null, 2) + '\n'`.

Register it in `core/lib/core/commands.js` (C1 entry) and add it to the JSDoc list of `context: 'repo'` / `validateRepoPath: false` commands there.

Add `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js`:
- exact JSON output for set/shadowed/unset tiers;
- `final` null/null when nothing is set;
- the usage error;
- scalar vs object/array values.

If there is a registry/bin-level spec that enumerates commands (under `core/spec/lib/core` or `core/spec/bin`), update it too.

## Files to Change
- `core/lib/utils/config/ConfigChain.js` — add `readTiers` plus a shared per-tier lookup helper.
- `core/spec/lib/utils/config/ConfigChain_spec.js` — `readTiers` coverage.
- `core/lib/commands/arcanum-check-config/ArcanumCheckConfig.js` — new command.
- `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js` — new spec.
- `core/lib/core/commands.js` — register `arcanum-check-config` and update the JSDoc.

## CI Checks
- `core`: `yarn test` (CI job: `test`), `yarn lint` (CI job: `checks`), both run from `core/`.

## Notes
- Don't add `arcanum-check-config` to `arcanum/_lib/migration-status.json`. Native-only commands stay out of it (C2).
- There is no shell twin and no parity spec, on purpose.
