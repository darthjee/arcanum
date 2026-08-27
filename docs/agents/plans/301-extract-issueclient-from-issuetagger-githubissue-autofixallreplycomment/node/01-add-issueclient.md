# Add IssueClient

Create `IssueClient`, a `RepoContext`-bound REST client for issue-domain GitHub calls, sibling to `core/lib/utils/github/GitHubClient.js` and following its exact construction/error-handling shape: `constructor({ context, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS })`, `repo`/`repoRef`/`token` resolved internally via `this._context` (never taken as method parameters), `fetch` with an `Authorization: Bearer <token>` header, `AbortSignal.timeout(this._timeoutMs)`, and a thrown `Error` with a descriptive message on any non-ok response or fetch failure (matching `getPr()`/`getPrCommits()`'s pattern).

Methods:

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getIssue(id)` | `GET /repos/{repo}/issues/{id}` | Returns the parsed issue body (used for its `labels` array by callers). |
| `addLabel(id, label)` | `POST /repos/{repo}/issues/{id}/labels` | Body `{ labels: [label] }`. |
| `removeLabel(id, label)` | `DELETE /repos/{repo}/issues/{id}/labels/{label}` (URL-encoded) | |
| `createIssue(title, body)` | `POST /repos/{repo}/issues` | Body `{ title, body }`; returns the created issue (its `number` is used by callers). |
| `postComment(number, body)` | `POST /repos/{repo}/issues/{number}/comments` | Body `{ body }`; PR comments live under the `issues` endpoint too, so this is reused for both. |

Error messages should mirror what the current call sites already produce, so the follow-up conversion steps can delegate without changing user-visible error text — check `IssueTagger#fetchLabels`/`#addLabel`/`#removeLabel`, `GithubIssue#fetch`/`#create`, and `AutoFixAllReplyComment#_postComment` (in their current, unconverted form) for the exact existing message shapes before finalizing this class's error strings.

## Files to Change

- `core/lib/utils/github/IssueClient.js` — **New.** The client described above.
- `core/spec/utils/github/IssueClient_spec.js` — **New.** Cover each method: success, not-found/non-ok response, malformed response, error message content.
