# Refactor PrOperations into a facade + parity spec

Refactor `PrOperations` to drop everything now extracted into steps 01–04, keeping only orchestration and `_prStateLabel` (the one pure function that stays put — PR-state derivation is `PrOperations`'s own responsibility, not one of the 4 extracted classes). The constructor now takes `RepoContext` + `GitClient` + `GitHubClient`; public methods drop `repoPath` (it now lives on `context`) and take no other params except `modelEmail` on `prMerge`.

```js
class PrOperations {
  constructor({ context, gitClient = new GitClient(),
                githubClient = new GitHubClient() }) { ... }

  async prNumber()           // git.currentBranch + context.getIssueState + github.getPr
  async prState()            // git.currentBranch + github.getPr + _prStateLabel
  async prMerge(modelEmail)  // git.currentBranch + github.getPr + MergeBodyResolver + github.mergePr + github.deleteBranch
  _prStateLabel(pull)        // pure function — unchanged
}
```

`prNumber()`, in full, illustrates the new orchestration shape every method follows:

```js
async prNumber() {
  const branch = await this._git.currentBranch(this._context.repoPath);
  const { repo, repoRef } = await this._context.resolveWithRef();
  const token = await this._context.getToken();
  const pull = await this._github.getPr(repo, branch, token, repoRef);
  // ...cached lookup via this._context.getIssueState(id, 'pr_id') when branch = issue-N
  return `${pull.number}\n`;
}
```

Since no spec file exists for `PrOperations` today, write `PrOperations_spec.js` from scratch **before** deleting the old private methods: read the current `PrOperations.js` in full and characterize its existing behavior (exact error messages, edge cases like no-PR-found, cached-`pr_id` shortcut, merge-body-mode branching) as parity tests against the *old* implementation first, then refactor and confirm the same spec still passes unchanged against the *new* facade. Mock all 3 collaborators (`RepoContext` via `repoContextFactory.js` from step 01, `GitClient`, `GitHubClient`) and verify orchestration matches prior behavior exactly.

This is the step that actually moves logic (steps 01–04 were additive-only) — but `PrOperations` still isn't imported with its new constructor shape by any caller yet (that's step 06), so the repo stays green at this commit via the parity spec alone.

## Files to Change

- `core/lib/utils/github/PrOperations.js` — refactored into a facade (see above); drop `_currentBranch`, `_findPr`, `_fetchPrCommits`, `_resolveMergerLogin`, `mergeBodyMode`, `_resolveMergeBody`, `_coauthorsBody`, `_uniqueByEmail`, `_modelCoauthorOmitted`, `_removeCoauthorsList`, `_mergePr`, `_deleteBranchRef`; keep `_prStateLabel`
- `core/spec/lib/utils/github/PrOperations_spec.js` — new parity spec, using `repoContextFactory.js`
