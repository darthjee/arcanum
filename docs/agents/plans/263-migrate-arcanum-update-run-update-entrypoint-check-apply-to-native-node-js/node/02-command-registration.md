# Register both commands

Register in `core/bin/arcanum`'s `COMMANDS` map (alphabetically ordered, matching the existing entries — insert near the other `arcanum-*`/`auto-fix-all-*` keys):

```js
'arcanum-update-run-update-check': { module: 'ArcanumUpdateRunUpdate.js', method: 'check' },
'arcanum-update-run-update-apply': { module: 'ArcanumUpdateRunUpdate.js', method: 'apply' },
```

Same precedent as `github-issue-create`/`github-issue-info` both mapping to `GithubIssue.js`, and `auto-fix-all-config-get`/`-is-enabled`/`-set`/`-toggle` all mapping to `AutoFixAllConfig.js`.

## Files to Change

- `core/bin/arcanum` — two new `COMMANDS` entries.
