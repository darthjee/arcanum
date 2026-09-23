# Register the six commands

Add six entries to `core/lib/core/commands.js`, keeping the table's alphabetical order (after `github-issue-info`, before `github-issue-update`):

```js
  'github-issue-mark-created': {
    module: 'commands/shared/GithubIssueMark.js',
    method: 'markCreated',
    context: 'repo',
    validateRepoPath: false
  },
  // ...mark-enhancing / mark-planning / mark-ready / mark-refined / mark-split
```

Use `validateRepoPath: false` because `cmd_mark_*` calls only `_load_origin`, never `repo_path_enter` (the same reasoning as `github-issue-info` / `github-issue-update`). A bad `repo_path` must therefore fail with `_load_origin`'s message, not `RepoContext#validate()`'s.

Update `core/spec/lib/core/commands_spec.js` to assert the six entries: module, method, `context: 'repo'` and `validateRepoPath: false`.

## Files to Change
- `core/lib/core/commands.js` — six new entries.
- `core/spec/lib/core/commands_spec.js` — assert them.
