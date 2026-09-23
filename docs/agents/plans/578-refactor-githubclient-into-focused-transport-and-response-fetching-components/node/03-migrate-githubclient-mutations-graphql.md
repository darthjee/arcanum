# Migrate GitHubClient mutations and GraphQL
Rewrite the remaining `GitHubClient` methods on the transport:

- `mergePr` → `request` with `method: 'PUT'`, `body: payload`. A rejected fetch now maps to `could not merge PR #<n> on <repo>`.
- `deleteBranch` → `bestEffort(() => request(..., { method: 'DELETE', failure }))`. It still never throws.
- `createPr` → the head comes from `this._git.currentBranch()`. `_defaultBranch` is simplified to take only `(repo, failure)` and use `requestJson` plus its `default_branch` check. The POST goes through `requestJson` plus the `html_url` check. Keep the single `could not create pull request on <repo>` error for every failure, including bad JSON.
- `markPrReady` → `graphql(query, { id: nodeId }, { failure })`.
- `_mutateReaction` → `bestEffort(() => graphql(query, { id: nodeId, content }, { failure }))`. `addReaction`/`removeReaction` keep their signatures and never throw.

Remove the now-unused `GRAPHQL_URL`/`DEFAULT_TIMEOUT_MS` constants from `GitHubClient.js` (they live in the transport), and drop the now-dead `try/catch` blocks. The file should shrink substantially. Update the class JSDoc to mention the transport.

Update `GitHubClient_spec.js`:
- Add "fetch rejects" cases for `mergePr`.
- Keep the existing best-effort, `createPr`, and `markPrReady` expectations green. GraphQL `method: 'POST'` + `Content-Type` headers must still match.

## Files to Change
- `core/lib/utils/github/GitHubClient.js` — rewrite mutations and GraphQL; remove dead helpers and constants.
- `core/spec/lib/utils/github/GitHubClient_spec.js` — add the new rejection cases; adjust only where the error-consistency change requires it.
