# Update GithubIssue to use a per-call IssueClient internally

As settled in the issue's discussion (see [node.md](../node.md)'s Notes), `GithubIssue`'s public API stays exactly as it is today — `fetch(repoPath, id)`, `create(repoPath, title, file)`, `info(repoPath)` — because `core/bin/arcanum`'s dispatch table constructs it with a zero-argument constructor and passes `repoPath` positionally into `create`/`info`. Only the internal implementation changes: replace the raw `this._fetch(...)` calls in `fetch`/`create` with delegation to a per-call `IssueClient`, mirroring `GithubIssue`'s own existing `_issueStateService(repoPath)` helper (which already builds a fresh `RepoContext`-bound collaborator per call for the exact same reason).

Concretely:
- Add a private `_issueClient(repoPath)` helper: builds a `RepoContext({ repoPath, origin: this._origin, githubToken: this._githubToken })` and returns `new IssueClient({ context, fetchFn: this._fetch, timeoutMs: this._timeoutMs })` — same shape as `_issueStateService(repoPath)`.
- `fetch(repoPath, id)`: replace the raw `this._fetch(\`https://api.github.com/repos/${repo}/issues/${id}\`, ...)` block with `await this._issueClient(repoPath).getIssue(id)`, keeping the existing error message (`Error: could not fetch issue #<id> from <repo>`) — check whether `IssueClient#getIssue`'s own error message (from [Step 01](01-add-issueclient.md)) matches, or whether this method needs to catch and re-throw with the exact current text.
- `create(repoPath, title, file)`: replace the raw `POST /repos/${repo}/issues` block with `await this._issueClient(repoPath).createIssue(title, body)`, same error-message-parity check as above (`Error: could not create issue on <repo>`).
- `info(repoPath)` doesn't call `_fetch` at all today (just resolves `origin`) — leave it untouched.
- The `domain`/`repo` values `fetch`/`create` currently return alongside the issue data still come from `this._origin.resolve(repoPath)` directly — no change needed there, `IssueClient` doesn't need to return them.

## Files to Change

- `core/lib/commands/GithubIssue.js` — add `_issueClient(repoPath)`; route `fetch`/`create`'s REST calls through it.
- `core/spec/commands/GithubIssue_spec.js` — expected to need little to no change (public API and constructor are untouched); update only if internal mocking assumptions (e.g. asserting on raw `fetchFn` call shape) need adjusting for the new internal call path.
