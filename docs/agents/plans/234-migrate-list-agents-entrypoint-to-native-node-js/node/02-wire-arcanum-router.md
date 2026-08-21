# Wire list-agents into the arcanum CLI router

Add the new command to `core/bin/arcanum`'s `COMMANDS` registry so `core/bin/arcanum list-agents <repo_path> [agents_dir]` dispatches to `ListAgents.js`.

## Files to Change

- `core/bin/arcanum` — add `'list-agents': { module: 'ListAgents.js', method: 'run' }` to `COMMANDS`, alongside the existing `checkout-safe-branch`/`resolve-and-fetch`/`resolve-id-and-file` entries.
