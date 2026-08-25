# Create MergeBodyResolver + spec

Add `MergeBodyResolver`, extracted from `PrOperations`'s `mergeBodyMode`/`_resolveMergeBody`/`_coauthorsBody`/`_uniqueByEmail`/`_modelCoauthorOmitted`/`_removeCoauthorsList` private methods — all merge-body-mode and co-authors logic. It receives `RepoContext` (for config reads) and `GitHubClient` (for commit fetch + merger-login resolution, via step 03's class) in its **constructor**.

```js
class MergeBodyResolver {
  constructor({ context, githubClient } = {}) { ... }

  async resolveMode()                                // context.readConfig('git', 'merge_body_mode')
  async buildBody(repo, number, token, modelEmail)   // orchestrates empty/full/coauthors
  async _coauthorsBody(repo, number, token, modelEmail)
  _uniqueByEmail(authors)                            // pure function — dedup + sort
  async _modelCoauthorOmitted()                     // context.readConfig('git', 'omit_model_coauthor')
  async _removeCoauthorsList()                       // context.readConfig('git', 'remove_coauthors')
}
```

Read `PrOperations.js`'s current `mergeBodyMode`/`_resolveMergeBody`/`_coauthorsBody`/`_uniqueByEmail`/`_modelCoauthorOmitted`/`_removeCoauthorsList` directly before writing this, to carry over exact dedup/sort/filter/formatting behavior unchanged (config keys read: `git`/`merge_body_mode`, `git`/`omit_model_coauthor`, `git`/`remove_coauthors` — same 3-arg shape `configChain.read(repoPath, 'git', key)` already used today, now routed through `context.readConfig(scope, key)`).

Use `repoContextFactory.js` (step 01) to build the mocked `RepoContext` in the spec. `MergeBodyResolver_spec.js` mocks `RepoContext` (config) and `GitHubClient` (commits), testing dedup, filter, and formatting behavior.

This step is purely additive — nothing imports `MergeBodyResolver` yet (that happens in steps 05/06).

## Files to Change

- `core/lib/utils/github/MergeBodyResolver.js` — new class (see above)
- `core/spec/lib/utils/github/MergeBodyResolver_spec.js` — new unit spec, using `repoContextFactory.js`
