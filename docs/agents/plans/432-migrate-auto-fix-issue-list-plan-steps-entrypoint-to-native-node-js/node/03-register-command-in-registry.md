# Register the command in the registry

Add the `auto-fix-issue-list-plan-steps` entry to `COMMANDS` in `core/lib/core/commands.js`, alongside (not replacing) the existing `auto-fix-issue-list-plan-agents` entry:

```js
'auto-fix-issue-list-plan-steps': {
  module: 'commands/auto-fix-issue/AutoFixIssueListPlanSteps.js',
  method: 'run'
},
```

No `context` key (defaults to `'none'`) — same as `auto-fix-issue-list-plan-agents`, since the shim never threads a `repo_path` positional into the native args (`planDir`, `agentName` only). Update the file-header JSDoc's `context: 'none'` bullet list (around the `auto-fix-issue-list-plan-agents` mention) to also name `auto-fix-issue-list-plan-steps`.

## Files to Change
- `core/lib/core/commands.js` — add the registry entry and extend the `context: 'none'` doc comment.
