# Register the command in core/bin/arcanum

Add `'auto-fix-all-cleanup-artifacts': { module: 'AutoFixAllCleanupArtifacts.js', method: 'run' }` to the `COMMANDS` map in `core/bin/arcanum`, keeping the map's existing alphabetical-by-key ordering.

## Files to Change

- `core/bin/arcanum` — add the `COMMANDS` entry
