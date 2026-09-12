# Register the command and flip migration status

Wire the new module into the command dispatcher and mark the entrypoint as
natively available.

- In `core/lib/core/commands.js`'s `COMMANDS` map, add (alphabetically, between
  `'auto-monitor-pr-monitor-pr'` and `'auto-plan-issue-commit-plan'`):

  ```js
  'auto-new-issue-commit-issue': {
    module: 'commands/auto-new-issue/AutoNewIssueCommitIssue.js',
    method: 'run',
    context: 'repo'
  },
  ```

- In `arcanum/_lib/migration-status.json`, flip `"auto-new-issue-commit-issue"`
  from `false` to `true`.
- Update `core/spec/lib/core/commands_spec.js`'s command-count/list assertions
  to account for the new entry (check how the sibling `auto-plan-issue-commit-plan`
  / `discuss-issue-render-issue` registrations updated this spec and follow the
  same pattern).

## Files to Change

- `core/lib/core/commands.js` — register the `auto-new-issue-commit-issue` command.
- `arcanum/_lib/migration-status.json` — flip `auto-new-issue-commit-issue` to `true`.
- `core/spec/lib/core/commands_spec.js` — update for the new registered command.
