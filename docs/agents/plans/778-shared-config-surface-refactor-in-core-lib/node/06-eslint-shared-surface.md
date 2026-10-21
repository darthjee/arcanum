# Declare the shared surface in ESLint and reword JSDoc

Append the shared-surface block from the spec's Guardrails section to `core/eslint.config.mjs`, **after** the existing `lib/utils/**` layering block (flat config: last matching block wins), with the explicit `files` list:
`lib/utils/config/ConfigChain.js`, `RepoConfig.js`, `RepoConfigWriter.js`, `ConfigError.js`, `AgentEmail.js`, `KeyRegistry.js`, `lib/utils/file/Lock.js`, `lib/utils/file/RepoPath.js`.

- `no-restricted-imports` allowlist: `**` minus `node:*`, the surface files and `./keys.json` (also `./LockTimeoutError.js`, which `Lock.js` imports — add it to both the allowlist and the `files` list, and to the spec table, since it is part of what `Lock` drags into the bundle).
- `no-restricted-syntax` banning `ImportExpression`.
- Comment pointing at `docs/agents/specs/arcanum-cli/shared-config-logic.md`; this list is the authoritative surface declaration.

Reword the `RepoContext` JSDoc in `ConfigChain.js` and `RepoConfig.js` to "optional, core-only — the CLI never passes it".

Verify with `yarn lint`, and sanity-check the rule by temporarily adding a forbidden import (e.g. `../../context/RepoContext.js`) to a surface file and seeing lint fail.

## Files to Change
- `core/eslint.config.mjs` — new shared-surface block.
- `core/lib/utils/config/ConfigChain.js`, `core/lib/utils/config/RepoConfig.js` — JSDoc wording.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — add `LockTimeoutError.js` to the surface table/snippet so table and ESLint agree.
