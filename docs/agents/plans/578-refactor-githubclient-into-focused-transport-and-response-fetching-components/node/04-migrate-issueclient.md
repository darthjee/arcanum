# Migrate IssueClient
Rewrite `core/lib/utils/github/IssueClient.js` on `GitHubTransport`. Keep its constructor signature `({ context, fetchFn, timeoutMs })` so `RepoContextFactory` needs no change.

- `getIssue` → `requestJson`.
- `addLabel` → `request` with `method: 'POST'`, `body: { labels: [label] }`.
- `removeLabel` → `request` with `method: 'DELETE'`.
- `createIssue` → `requestJson` with `method: 'POST'`, `body: { title, body }`.
- `postComment` → `request` with `method: 'POST'`, `body: { body }`.

Keep all existing URLs (including `encodeURIComponent(label)`) and error messages. IssueClient already maps rejected fetches. The only behavior change is that unparseable JSON in `getIssue`/`createIssue` now throws the domain error. Add spec cases for that in `IssueClient_spec.js`. Check that `githubIssueCreateSharedExamples.js` and any other shared examples exercising `IssueClient` still pass.

## Files to Change
- `core/lib/utils/github/IssueClient.js` — rewrite on the transport; drop the duplicated constants and try/catch.
- `core/spec/lib/utils/github/IssueClient_spec.js` — add malformed-JSON cases.
