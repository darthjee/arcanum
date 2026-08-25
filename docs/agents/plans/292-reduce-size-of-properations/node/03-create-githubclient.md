# Create GitHubClient + spec

Add `GitHubClient`, extracted from `PrOperations`'s `_findPr`/`_fetchPrCommits`/`_resolveMergerLogin`/`_mergePr`/`_deleteBranchRef` private methods, encapsulating all GitHub REST API communication — auth, timeout, error handling. `token` comes in as a method parameter, **not** from the constructor, and the class doesn't know about `RepoContext`. It's a singleton, like `GitClient`.

```js
class GitHubClient {
  constructor({ fetchFn = fetch, timeoutMs = 30000 } = {}) { ... }

  async getPr(repo, branch, token, repoRef)        // GET /repos/{repo}/pulls
  async getPrCommits(repo, number, token)          // GET /repos/{repo}/pulls/{n}/commits
  async mergePr(repo, number, token, payload)     // PUT /repos/{repo}/pulls/{n}/merge
  async deleteBranch(repo, branch, token)          // DELETE /repos/{repo}/git/refs/heads/{branch}
  async getCurrentUser(token)                      // GET /user
}
```

Each method encapsulates: URL construction → headers (`Authorization: Bearer`) → `AbortSignal.timeout` → check `response.ok` → parse JSON. Read `PrOperations.js`'s current `_findPr`/`_fetchPrCommits`/`_resolveMergerLogin`/`_mergePr`/`_deleteBranchRef` directly before writing this, to carry over exact URL shapes, headers, and thrown-error messages unchanged — `PrOperations_spec.js` (step 05) parity-tests against this exact behavior.

`GitHubClient_spec.js` mocks `fetchFn`, verifying URL, headers, payload, and error handling (non-`ok` response, timeout) per method.

This step is purely additive — nothing imports `GitHubClient` yet (that happens in steps 04/05/06).

## Files to Change

- `core/lib/utils/github/GitHubClient.js` — new class, alongside the existing `GithubToken.js` (see above)
- `core/spec/lib/utils/github/GitHubClient_spec.js` — new unit spec
