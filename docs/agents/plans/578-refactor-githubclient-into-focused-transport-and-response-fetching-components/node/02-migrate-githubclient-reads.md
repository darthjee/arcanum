# Migrate GitHubClient read methods
In the `GitHubClient` constructor, build `this._transport = new GitHubTransport({ context, fetchFn, timeoutMs })`. Keep the constructor signature and the `this._git` default. Then rewrite the GET methods on top of the transport, each passing its existing error message as `failure`:

- `getPr` → `requestArray` on `/repos/${repo}/pulls?head=...&state=all`. It keeps its own "first element with a `number`" check and its single not-found error.
- `getPrCommits`, `getPrReviews`, `getIssueComments`, `getPrReviewComments` → `requestArray`.
- `getPrHeadSha` → `requestJson` plus its own `head.sha` check (a distinct second error message).
- `getCheckRuns` → `requestJson` plus its own `check_runs` array check (a distinct malformed error message, not `[]`).
- `getCurrentUser` → `requestJson('/user', ...)`. No repo resolution, same as today.
- `getPrState` → `requestJson`.

Behavior change, by design: a rejected fetch (network error or timeout) or unparseable JSON now throws the method's own domain error instead of leaking the raw error. Update or add spec cases in `GitHubClient_spec.js` to assert this for each migrated method. Every other existing expectation (URLs, headers, messages, `[]` normalization) must stay green unchanged.

## Files to Change
- `core/lib/utils/github/GitHubClient.js` — construct the transport; rewrite the read methods.
- `core/spec/lib/utils/github/GitHubClient_spec.js` — add "fetch rejects" and "malformed JSON" cases that now expect the domain errors.
