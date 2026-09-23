# Register the commands

Add to `core/lib/core/commands.js`, next to `github-issue-create` / `github-issue-info`:

```js
'github-issue-fetch': {
  module: 'commands/shared/GithubIssue.js',
  method: '<CLI fetch method name from step 02>',
  context: 'repo'
},
'github-issue-update': {
  module: 'commands/shared/GithubIssue.js',
  method: 'update',
  context: 'repo',
  validateRepoPath: false
},
```

`update` sets `validateRepoPath: false` because `cmd_update` never calls `repo_path_enter`. Its only repo-level failure is `_load_origin`'s, which `Origin#resolve` already reproduces (same rationale as `github-issue-info`). Extend `core/spec/lib/core/commands_spec.js` (and any registry/dispatcher specs that enumerate entries) to cover both.

## Files to Change
- `core/lib/core/commands.js` — two new registry entries.
- `core/spec/lib/core/commands_spec.js` — registry coverage.
