# Register the commands

Add the three entries to `COMMANDS` in `core/lib/core/commands.js` with `context: 'repo'` and `validateRepoPath: false`, per the shared contracts. Update the `CommandEntry` typedef comment that lists which commands use `'repo'` / `validateRepoPath: false`.

## Files to Change
- `core/lib/core/commands.js` — three new entries plus the doc comment.
- `core/spec/lib/core/commands_spec.js` — assert the new entries.
