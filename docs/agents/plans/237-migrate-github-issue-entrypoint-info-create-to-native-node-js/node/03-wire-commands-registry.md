# Wire both into core/bin/arcanum's COMMANDS registry

Add two entries to the `COMMANDS` registry in `core/bin/arcanum`:

```js
const COMMANDS = {
  'checkout-safe-branch': { module: 'SafeBranch.js', method: 'run' },
  'dispatch-fixture': { module: 'DispatchFixture.js', method: 'run', log: false },
  'dispatch-fixture-crash': { module: 'DispatchFixture.js', method: 'crash' },
  'github-issue-create': { module: 'GithubIssue.js', method: 'create' },
  'github-issue-info': { module: 'GithubIssue.js', method: 'info' },
  'list-agents': { module: 'ListAgents.js', method: 'run' },
  'resolve-and-fetch': { module: 'ResolveAndFetch.js', method: 'run' },
  'resolve-id-and-file': { module: 'ResolveIdAndFile.js', method: 'run' },
  'resolve-plan-paths': { module: 'ResolvePlanPaths.js', method: 'run' }
};
```

(Keep alphabetical order, matching the existing list.)

No other changes needed in this file — `dispatch()` already handles string-returning methods generically (writes `output` to stdout when `typeof output === 'string'`), which is why Steps 1–2 return strings directly instead of objects.

## Files to Change

- `core/bin/arcanum` — add the two `COMMANDS` entries.
