# GitHubClient becomes context-bound

Update the existing `GitHubClient` (`core/lib/utils/github/GitHubClient.js`) to take `context` in its constructor and resolve `token`/`repo`/`repoRef` internally on every call, dropping them from every method signature (not just `token` — see the issue's "Alternatives Considered": full context-binding was chosen over keeping `repo`/`repoRef` as explicit params):

- Constructor: `{ context, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }`.
- `getPr(branch)` — resolves `{ repo, repoRef } = await this._context.resolveWithRef()` and `token = await this._context.getToken()` internally; the not-found error message keeps using `repoRef` exactly as today (`no pull request found for the current branch on <repoRef>`), just sourced from context instead of a param.
- `mergePr(number, payload)` — resolves `repo`/`token` internally.
- `deleteBranch(branch)` — resolves `repo`/`token` internally.
- `getPrCommits(number)` — resolves `repo`/`token` internally.
- `getCurrentUser()` — resolves `token` internally (no `repo` involved, same as today).

`GitHubClient` becomes a per-repo instance as a result (one `context` = one client) — this is the acknowledged trade-off from the issue, not a bug: `PrOperations` already only ever holds one `context` per lifecycle, so instance reusability across repos isn't a real cost. It's `AutoFixAllGithub` (step 06) that has to change to stop treating it as a repo-agnostic singleton.

## Files to Change

- `core/lib/utils/github/GitHubClient.js` — constructor takes `context`; every method drops its `repo`/`repoRef`/`token` params and resolves them via `this._context` instead
- `core/spec/lib/utils/github/GitHubClient_spec.js` — update to construct `GitHubClient` with a stub/fake `context` (exposing `getToken()`/`resolveWithRef()`) and call each method with only its remaining domain params (`branch`, `number`, `payload`)
