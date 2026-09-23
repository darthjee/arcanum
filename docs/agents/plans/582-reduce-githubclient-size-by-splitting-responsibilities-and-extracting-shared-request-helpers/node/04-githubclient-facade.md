# Turn GitHubClient into a delegating facade

Replace `GitHubClient`'s method bodies with delegation:

- Constructor keeps `{ context, fetchFn, timeoutMs, git = new Git({ context }) }`, builds **one** `GitHubTransport({ context, fetchFn, timeoutMs })`, and passes it to the four focused clients (forwarding `git` to `GitHubPullRequestClient`).
- Each of the 14 public methods becomes a one-line delegation to the owning client (e.g. `getPr(branch) { return this._pullRequests.getPr(branch); }`), with short JSDoc pointing at the focused client's method (`@see`-style) instead of the full doc.
- `static prStateLabel(pull) { return GitHubPullRequestClient.prStateLabel(pull); }`.
- Update the class JSDoc: `GitHubClient` is a compatibility facade over the four focused clients; list which client owns which concern.
- Remove the now-unused private helpers (`_defaultBranch`, `_mutateReaction`) from the facade.

Add a lightweight `core/spec/lib/utils/github/GitHubClient_spec.js`:
- Each public method delegates to the right focused client with the same arguments and returns its result (a table-driven spec to avoid duplication — spy on the focused client's prototype method or on the instance's private client field).
- `GitHubClient.prStateLabel` delegates to `GitHubPullRequestClient.prStateLabel`.
- The constructor forwards `git` (e.g. `createPr` uses the injected `git.currentBranch()`), and `fetchFn`/`timeoutMs` reach the transport (a request goes through the injected `fetchFn`).

`GitHubClientErrorMapping_spec.js` stays and keeps running through `newGitHubClient` as an end-to-end check that the facade preserves every read method's error mapping.

Finally, run the full `core/` suite, lint and the duplication report. All caller and parity specs (`PrOperations`, `PrMonitor`, `MergeBodyResolver`, `AutoFixIssueGithub`, `AutoMonitorIssuePrResolvePrNumber`, `RepoContextFactory`, `*Parity_spec.js`) must pass **unchanged**, and `core/spec/support/factories/githubClient.js`'s `newGitHubClient` must keep working as-is.

## Files to Change
- `core/lib/utils/github/GitHubClient.js` — reduce to a delegating facade.
- `core/spec/lib/utils/github/GitHubClient_spec.js` — new delegation spec.
