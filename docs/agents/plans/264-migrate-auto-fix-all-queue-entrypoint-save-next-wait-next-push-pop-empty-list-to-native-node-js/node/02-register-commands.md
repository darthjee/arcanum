# Register COMMANDS entries

Register the 7 subcommands in `core/bin/arcanum`'s `COMMANDS` map, alongside the existing `auto-fix-all-*` entries:

```js
'auto-fix-all-queue-save': { module: 'AutoFixAllQueue.js', method: 'save' },
'auto-fix-all-queue-next': { module: 'AutoFixAllQueue.js', method: 'next' },
'auto-fix-all-queue-wait-next': { module: 'AutoFixAllQueue.js', method: 'waitNext' },
'auto-fix-all-queue-push': { module: 'AutoFixAllQueue.js', method: 'push' },
'auto-fix-all-queue-pop': { module: 'AutoFixAllQueue.js', method: 'pop' },
'auto-fix-all-queue-empty': { module: 'AutoFixAllQueue.js', method: 'empty' },
'auto-fix-all-queue-list': { module: 'AutoFixAllQueue.js', method: 'list' },
```

These exact command-name strings must match what scripter's `queue.sh` shim dispatches on and what `arcanum/_lib/migration-status.json` gets flipped to `true` for (see [plan.md](../plan.md)'s "Shared contracts").

## Files to Change

- `core/bin/arcanum` — add the 7 `COMMANDS` entries.
