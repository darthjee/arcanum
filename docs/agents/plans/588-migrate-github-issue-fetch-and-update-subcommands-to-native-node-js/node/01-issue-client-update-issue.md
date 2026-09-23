# Add IssueClient#updateIssue

Add `async updateIssue(id, { title, body })` to `core/lib/utils/github/IssueClient.js`. It PATCHes `/repos/<repo>/issues/<id>` with body `{ title, body }` through `this._transport.repoRequest` (the response body is not needed; `cmd_update` discards it). On any failed request it throws `Error: could not update issue #<id> on <repo>`. Follow the JSDoc style of `createIssue`/`addLabel`.

Add specs covering the request method/path/payload and the error message on a rejected fetch and on a non-ok response, following the existing per-method spec layout for `IssueClient` (`core/spec/lib/utils/github/IssueClient_spec.js` or its split siblings).

## Files to Change
- `core/lib/utils/github/IssueClient.js` — new `updateIssue` method.
- `core/spec/lib/utils/github/IssueClient_spec.js` (or a new `IssueClientUpdateIssue_spec.js` sibling, matching how the file is currently split) — specs.
