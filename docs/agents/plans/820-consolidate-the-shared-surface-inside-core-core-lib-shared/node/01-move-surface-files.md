# Move the surface files

`git mv` the 10 paths listed in [plan.md](../plan.md#shared-contracts) into `core/lib/shared/config/` and `core/lib/shared/file/`. Inside the moved files, relative imports between them keep working (`./`, `../file/`, `../config/` keep their shape). Fix any import that pointed outside them — the moved files must end up importing only `node:` built-ins and each other.

Rewrite every importer in `core/lib/` and `core/bin/` to the new paths (e.g. `../../utils/config/ConfigChain.js` → `../../shared/config/ConfigChain.js`). Today's importers include `core/lib/commands/**`, `core/lib/context/{ClaudeContext,RepoContext}.js`, `core/lib/core/dispatcher.js`, `core/lib/services/IssueStateService.js`, and the core-only `core/lib/utils/config/{KeyRegistry,NamespacedBooleanKeyConfig}` and `core/lib/utils/file/InstallRoot.js` users. No re-export shims.

Repoint code comments in `core/lib/` that name the old paths, including the `KeyRegistry.js` strict-mode error string (`core/lib/utils/config/keys.json` → `core/lib/shared/config/keys.json`) and its JSDoc. Doc links to `docs/agents/specs/...` stay as they are.

## Files to Change
- `core/lib/utils/config/{ConfigChain,RepoConfig,RepoConfigWriter,ConfigError,AgentEmail,KeyRegistry}.js`, `keys.json` → `core/lib/shared/config/`
- `core/lib/utils/file/{Lock,LockTimeoutError,RepoPath}.js` → `core/lib/shared/file/`
- every importer under `core/lib/` and `core/bin/` — import paths only
