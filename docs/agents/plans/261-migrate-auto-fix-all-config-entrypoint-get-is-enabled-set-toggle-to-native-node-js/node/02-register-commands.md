# Register the four commands in core/bin/arcanum

Add four entries to `core/bin/arcanum`'s `COMMANDS` map (keep the map's existing alphabetical-ish ordering, inserting these near the other `auto-fix-all-*` entries):

```js
'auto-fix-all-config-get': { module: 'AutoFixAllConfig.js', method: 'get' },
'auto-fix-all-config-is-enabled': { module: 'AutoFixAllConfig.js', method: 'isEnabled' },
'auto-fix-all-config-set': { module: 'AutoFixAllConfig.js', method: 'set' },
'auto-fix-all-config-toggle': { module: 'AutoFixAllConfig.js', method: 'toggle' }
```

No other change to `core/bin/arcanum` is needed — `dispatch()` already awaits the returned promise, prints a returned string to stdout, and special-cases `DispatchFailure` exactly as these methods rely on (see `plan.md`'s Shared contracts).

## Files to Change

- `core/bin/arcanum` — add the four `COMMANDS` entries above.
