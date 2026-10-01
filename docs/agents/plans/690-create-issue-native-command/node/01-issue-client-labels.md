# IssueClient labels argument

`IssueClient.createIssue(title, body)` gains an optional labels argument
(`createIssue(title, body, labels)`), sent as `labels` in the single POST body when non-empty.
Existing callers keep working unchanged. Add a service-level create path (in
`GithubIssueService`, or reuse its origin/transport wiring) that creates an issue with labels and
returns `{ number, html_url }` without writing to `docs/agents/issues/`.

## Files to Change

- `core/lib/utils/github/IssueClient.js` — optional `labels` param on `createIssue`
- `core/lib/services/GithubIssueService.js` — label-aware create that does not write a local file
- `core/spec/lib/utils/github/IssueClient_spec.js` — labels included / omitted cases
- `core/spec/lib/services/GithubIssueService_spec.js` — new create path
