# Register the command

Wire the new module into `core/bin/arcanum`'s `COMMANDS` map (see the existing `spawn-issue`/`checkout-safe-branch`/`issue-state` entries for the pattern):

```js
'arcanum-split-issue-finish': { module: 'ArcanumSplitIssueFinish.js', method: 'run' },
```

Keep the map's existing alphabetical-by-key ordering when inserting the new entry.

## Files to Change

- `core/bin/arcanum` — add the `arcanum-split-issue-finish` entry to `COMMANDS`.
