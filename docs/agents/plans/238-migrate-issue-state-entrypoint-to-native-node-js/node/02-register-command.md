# Register the issue-state command

Wire the new `IssueState#run` method into `core/bin/arcanum`'s `COMMANDS` registry, following the existing entries' shape exactly (e.g. `'checkout-safe-branch': { module: 'SafeBranch.js', method: 'run' }`).

```js
'issue-state': { module: 'IssueState.js', method: 'run' },
```

Keep the registry's existing alphabetical-ish ordering (insert next to `'dispatch-fixture-crash'`/`'list-agents'` per current ordering, or wherever alphabetization actually lands `issue-state`).

## Files to Change

- `core/bin/arcanum` — add the `issue-state` entry to the `COMMANDS` map.
