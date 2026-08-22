# Register the command and flip migration-status.json

Wire the new module into the centralized native entrypoint and mark the migration as live.

1. In `core/bin/arcanum`'s `COMMANDS` map, add an entry alongside the existing ones (e.g. right after `arcanum-split-issue-create-sub-issue-file`, since they're siblings):

   ```js
   'arcanum-split-issue-create-sub-issue': {
     module: 'ArcanumSplitIssueCreateSubIssue.js',
     method: 'run'
   },
   ```

2. In `arcanum/_lib/migration-status.json`, flip `"arcanum-split-issue-create-sub-issue"` from `false` to `true` — this is the switch `engine_dispatch.sh` (consulted by scripter's shim) checks before routing to native.

## Files to Change

- `core/bin/arcanum` — register the `arcanum-split-issue-create-sub-issue` command.
- `arcanum/_lib/migration-status.json` — flip `arcanum-split-issue-create-sub-issue` to `true`.
