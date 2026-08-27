# Add GitHubClient.getPrHeadSha() and getCheckRuns()

Add two `RepoContext`-bound REST methods to `GitHubClient`, following the exact pattern of the existing `getPr(branch)`/`getPrCommits(number)` methods: resolve `repo`/`token` internally via `this._context`/`this._context.getToken()` (never as parameters), use `this._fetch` with an `Authorization: Bearer` header and `AbortSignal.timeout(this._timeoutMs)`, and throw a structured `Error` on failure rather than swallowing it (unlike `AutoFixAllWaitCi`'s current `_fetchHeadSha`/`_fetchCheckRuns`, which also throw on failure — this part carries over unchanged; only the swallow-and-retry behavior moves to `SafeFetcher` in Step 3).

- `getPrHeadSha(prNumber)` — `GET /repos/{repo}/pulls/{prNumber}`, returns `pull.head.sha`. Throws `Error: could not fetch pull request #<prNumber> from <repo>` on a non-ok response, and `Error: could not resolve head commit for pull request #<prNumber> in <repo>` if the response has no `head.sha` — same messages as the current `AutoFixAllWaitCi#_fetchHeadSha`.
- `getCheckRuns(sha)` — `GET /repos/{repo}/commits/{sha}/check-runs?per_page=100`, returns `body.check_runs`. Throws `Error: could not fetch check-runs for <sha> in <repo>` on a non-ok response, and `Error: malformed check-runs response for <sha> in <repo>` if `check_runs` isn't an array — same messages as the current `AutoFixAllWaitCi#_fetchCheckRuns`.

Preserving the exact error messages keeps `PrChecker`'s and the command's downstream behavior (Steps 4–5) byte-identical to today's output.

## Files to Change

- `core/lib/utils/github/GitHubClient.js` — add `getPrHeadSha(prNumber)` and `getCheckRuns(sha)`.
- `core/spec/lib/utils/github/GitHubClient_spec.js` — new tests: success, not-found/non-ok response, malformed response, for both methods.
