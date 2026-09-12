# Register the command

Add the `discuss-issue-render-issue` entry to `core/lib/core/commands.js`'s `COMMANDS` map, alongside the other `discuss-issue-*` entries:

```js
'discuss-issue-render-issue': {
  module: 'commands/discuss-issue/DiscussIssueRenderIssue.js',
  method: 'run',
  context: 'repo'
},
```

Also update the file's leading `CommandEntry`/`COMMANDS` doc comment, which enumerates every `context: 'repo'` command by name — add `discuss-issue-render-issue` to that list (matching how each prior migrated entrypoint's name was appended there) so the comment stays an accurate index.

## Files to Change

- `core/lib/core/commands.js` — add the `discuss-issue-render-issue` registry entry and extend the doc comment's `context: 'repo'` enumeration.
