# Register auto-fix-issue-run-checks in the command registry

Add the entry to `core/lib/core/commands.js`'s `COMMANDS` map, alongside the other `auto-fix-issue-*` entries, with no `context` key (matching `auto-fix-issue-list-plan-agents`/`-list-plan-steps`, which also rely on cwd rather than a threaded `repoPath`):

```js
'auto-fix-issue-run-checks': {
  module: 'commands/auto-fix-issue/AutoFixIssueRunChecks.js',
  method: 'run'
},
```

## Files to Change
- `core/lib/core/commands.js` — add the `'auto-fix-issue-run-checks'` entry.
