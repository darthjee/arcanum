# Register the command

Wire `AutoFixIssueCreateBranch` into the dispatch table so `core/bin/arcanum auto-fix-issue-create-branch <plan_dir> <id>` (with `repoPath` bound via `RepoContext`) reaches it.

- Add `'auto-fix-issue-create-branch': { module: 'commands/auto-fix-issue/AutoFixIssueCreateBranch.js', method: 'run', context: 'repo' }` to `COMMANDS` in `core/lib/core/commands.js`, in the same alphabetically-sorted spot the map already keeps its `context: 'repo'` entries.
- Update the existing "sets `context: 'repo'` on the migrated ..." spec in `core/spec/lib/core/commands_spec.js`: add `auto-fix-issue-create-branch` to both the test description string and the expected array, in the correct alphabetical position — same edit shape #428 made for `auto-fix-issue-commit-change`.

## Files to Change
- `core/lib/core/commands.js` — add the `auto-fix-issue-create-branch` entry to `COMMANDS`.
- `core/spec/lib/core/commands_spec.js` — extend the `context: 'repo'` list expectation.
