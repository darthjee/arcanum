# Update core/bin/arcanum's registry and direct imports

`core/bin/arcanum` is the one place outside `core/lib/`/`core/spec/lib/` with a functional (not cosmetic) dependency on the old flat layout — it must be updated after steps 01–02 relocate every file it references.

Two distinct edits:

1. **`COMMANDS` registry** — every entry's `module:` value is currently a bare filename (e.g. `'SpawnIssue.js'`) resolved via `path.join(libDir, entry.module)`. Since every dispatched file now lives under `core/lib/commands/` (per step 02), prefix every `module:` value with `commands/` (e.g. `'commands/SpawnIssue.js'`). All ~23 unique modules referenced in the table need this prefix — none of them end up anywhere else, since dispatch-table membership is exactly the `commands/` criterion this reorg uses.
2. **Direct imports** — `core/bin/arcanum` imports `DispatchFailure.js` and `InvocationLog.js` directly (not through `COMMANDS`/`libDir`, via static `import` statements at the top of the file). Update these two import paths to their new locations: `../lib/utils/errors/DispatchFailure.js` and `../lib/utils/logging/InvocationLog.js`.

## Files to Change

- `core/bin/arcanum` — prefix every `COMMANDS[...].module` value with `commands/`; update the `DispatchFailure` and `InvocationLog` import paths
- `core/spec/bin/arcanum_spec.js` — check for any hardcoded module/path strings that assert on the old flat layout and update them to match
