# Slim AutoFixAllWaitCi down to orchestration

Rework `AutoFixAllWaitCi` to match the target shape in the issue, mirroring `AutoFixAllGithub`'s `_prOperations(repoPath)` precedent exactly (per-call, context-bound collaborators — not constructor singletons, since `repoPath` isn't known until `run(repoPath)`):

- Remove `_fetchHeadSha`, `_fetchCheckRuns`, `_resolvePrNumber`, `_pollOnce`, `_safeFetch`, `_isIgnored`, `_currentBranch` entirely.
- Add `_prOperations(repoPath)`: build a `RepoContext` (from `repoPath` plus the constructor's shared `origin`/`githubToken`), then a context-bound `GitClient`/`GitBranch`/`Git`/`GitHubClient`, and return a `PrOperations` built from them — copy `AutoFixAllGithub#_prOperations`'s body, adjusted for this class's constructor field names (`this._fetch`/`this._timeoutMs`/`this._execFileAsync`, no `issueStateService`/`configChain` — `AutoFixAllWaitCi` never had those, don't add them here).
- Add `_prChecker(repoPath)`: `return new PrChecker({ prOperations: this._prOperations(repoPath) });`
- Rewrite `run(repoPath)`:
  ```js
  async run(repoPath) {
    if (!repoPath) throw new Error(USAGE);

    const ignoredPatterns = await this._repoConfig.getIgnoredCheckPatterns(repoPath);
    const prNumber = Number((await this._prOperations(repoPath).prNumber()).trim());
    const prChecker = this._prChecker(repoPath);

    for (;;) {
      const outcome = await prChecker.pollOnce(prNumber, ignoredPatterns);
      if (outcome !== null) return outcome;
      await this._sleep(this._pollIntervalMs);
    }
  }
  ```
  Note the `Number(...trim())` coercion — `PrOperations#prNumber()` returns a CLI-formatted string (e.g. `"42\n"`, possibly from a cached `pr_id`), but `PrChecker#pollOnce` needs a numeric PR number for the REST path segment.
- Drop the constructor's `_origin`/`_githubToken` direct field usage inside `run()` (they're now only consumed via `_prOperations`), but keep them as constructor fields — `_prOperations` reads `this._origin`/`this._githubToken` the same way `AutoFixAllGithub#_prOperations` does.
- `pollIntervalMs`, `execFileAsync`, `fetchFn`, `timeoutMs`, `sleepFn` all stay on the constructor unchanged, per the issue's "Resulting AutoFixAllWaitCi" section — they're forwarded into each call's fresh `_prOperations(repoPath)`/`_prChecker(repoPath)` build, not replaced.
- `repoConfig`/`getIgnoredCheckPatterns` usage is untouched.

Import `RepoContext`, `GitClient`, `GitBranch`, `Git`, `GitHubClient`, `PrOperations`, `PrChecker` at the top of the file (drop nothing else already imported that's still needed, e.g. `Origin`/`GithubToken`/`RepoConfig`).

## Files to Change

- `core/lib/commands/AutoFixAllWaitCi.js` — remove the 7 extracted private methods, add `_prOperations(repoPath)`/`_prChecker(repoPath)`, rewrite `run()`.
