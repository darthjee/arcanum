# Register the command

Add a new entry to the `COMMANDS` map in `core/bin/arcanum`, in alphabetical order alongside the other `auto-fix-all-*` entries:

```js
'auto-fix-all-wait-ci-and-merge': { module: 'AutoFixAllWaitCiAndMerge.js', method: 'run' },
```

This makes `core/bin/arcanum auto-fix-all-wait-ci-and-merge <repo_path> [model_email]` route to `AutoFixAllWaitCiAndMerge#run`, spreading the remaining argv as positional args — same convention as every other migrated entrypoint in this file.

Flipping `arcanum/_lib/migration-status.json`'s `"auto-fix-all-wait-ci-and-merge"` key to `true` — the flag `engine_dispatch.sh` reads to actually route to this new command — is `scripter`'s step (see [scripter.md](../scripter.md)), since that file lives under `arcanum/_lib/`.

## Files to Change

- `core/bin/arcanum` — add the `COMMANDS` entry.
