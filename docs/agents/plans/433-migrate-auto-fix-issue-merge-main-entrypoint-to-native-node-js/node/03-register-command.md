# Register the command

In `core/lib/core/commands.js`:

1. Add the `COMMANDS` map entry, alphabetically right after `'auto-fix-issue-list-plan-steps'` (line ~224) and before `'checkout-safe-branch'`:

   ```js
   'auto-fix-issue-merge-main': {
     module: 'commands/auto-fix-issue/AutoFixIssueMergeMain.js',
     method: 'run',
     context: 'repo'
   },
   ```

2. Update the file's top `CommandEntry` JSDoc comment (the `context: 'repo'` bullet listing every command using that context, lines ~17–19) to also name `auto-fix-issue-merge-main` alongside `auto-fix-issue-commit-change` and `auto-fix-issue-create-branch` — same bullet, appended to the existing list, matching how each prior `auto-fix-issue-*` migration kept that list in sync.

## Files to Change

- `core/lib/core/commands.js` — add the `COMMANDS` entry and update the `context: 'repo'` JSDoc bullet.
