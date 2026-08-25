# Adjust AutoFixAllGithub to create RepoContext per-call

Wire everything together: `AutoFixAllGithub` now builds a `RepoContext` per call (not per instance — `repoPath` differs call to call) and instantiates `PrOperations` per call with that `RepoContext`, plus its already-shared `GitClient`/`GitHubClient` singletons. This is the step where the new classes actually become reachable — the repo was green at every prior commit only because nothing imported them yet.

```js
class AutoFixAllGithub {
  constructor({
    origin = new Origin(), githubToken = new GithubToken(),
    fetchFn = fetch, timeoutMs, issueState, configChain, execFileAsync,
    gitClient = new GitClient({ execFileAsync }),
    githubClient = new GitHubClient({ fetchFn, timeoutMs }),
    // issueTagger, branchCleanup...
  } = {}) {
    this._origin = origin; this._githubToken = githubToken;
    this._issueState = issueState; this._configChain = configChain;
    this._gitClient = gitClient; this._githubClient = githubClient;
  }

  async prNumber(repoPath) {
    const context = new RepoContext({ repoPath, origin: this._origin,
      githubToken: this._githubToken, issueState: this._issueState,
      configChain: this._configChain });
    return new PrOperations({ context, gitClient: this._gitClient,
      githubClient: this._githubClient }).prNumber();
  }

  async prState(repoPath)  { /* same pattern */ }
  async prMerge(repoPath, modelEmail) { /* same pattern + modelEmail */ }
}
```

The public API is unchanged — the router keeps calling `new AutoFixAllGithub().prNumber('/repo/path')` exactly as before, and `prNumber`/`prState`/`prMerge` keep their existing `(repoPath, ...)` signatures; only the internals change. `hasShipitLabel`, `addTag`, `removeTag`, `cleanupBranch` are untouched — they don't go through `PrOperations`.

Update `AutoFixAllGithub`'s existing tests to reflect that `prOperations` is no longer a single injected instance but constructed per-call from `RepoContext`/`GitClient`/`GitHubClient` — adjust mocking strategy accordingly rather than injecting a `prOperations` double directly.

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — adjusted per-call `RepoContext`/`PrOperations` construction (see above)
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — updated to match the new per-call construction (mock at the `RepoContext`/`GitClient`/`GitHubClient` level instead of injecting `prOperations` directly)
