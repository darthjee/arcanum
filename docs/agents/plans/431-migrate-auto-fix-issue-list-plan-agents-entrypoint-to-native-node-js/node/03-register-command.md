# Register auto-fix-issue-list-plan-agents in the command registry

Add the `auto-fix-issue-list-plan-agents` entry (`context: 'repo'`) to the `COMMANDS` map in `core/lib/core/commands.js`:

```js
'auto-fix-issue-list-plan-agents': { module: 'commands/auto-fix-issue/AutoFixIssueListPlanAgents.js', method: 'run' }
```

Follow the exact key ordering/style already used for `auto-fix-issue-create-branch` and `auto-fix-issue-commit-change` in the same map.

## Files to Change
- `core/lib/core/commands.js` — add the `auto-fix-issue-list-plan-agents` entry to `COMMANDS`.
- `core/spec/core/commands_spec.js` — extend the `context: 'repo'` list expectation to include `auto-fix-issue-list-plan-agents`, matching how the spec was extended for #429/#428.
