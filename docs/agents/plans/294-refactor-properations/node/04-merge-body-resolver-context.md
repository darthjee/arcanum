# MergeBodyResolver absorbs repo/token

`MergeBodyResolver` (`core/lib/utils/github/MergeBodyResolver.js`) already receives `context` in its constructor — this step removes its remaining `repo`/`token` method params now that `GitHubClient` (step 03) no longer needs them passed through either:

- `buildBody(number, modelEmail)` — drops `repo` and `token` entirely (was `buildBody(repo, number, token, modelEmail)`).
- `_coauthorsBody(number, modelEmail)` — drops `repo`/`token`; its calls to `this._github.getPrCommits(...)`/`this._resolveMergerLogin(...)` update to the new no-repo/no-token `GitHubClient` signatures from step 03 (`this._github.getPrCommits(number)`, and `_resolveMergerLogin()` drops its own `token` param since `this._github.getCurrentUser()` no longer takes one).
- `resolveMode()`, `_modelCoauthorOmitted()`, `_removeCoauthorsList()`, `_uniqueByEmail()` — unchanged; they never took `repo`/`token`.

`PrOperations` no longer calls `_resolveMergeBody` after this (removed in step 05) — it delegates directly to the injected `MergeBodyResolver`:

```js
// Before (current):
const body = await this._resolveMergeBody(repo, number, token, modelEmail);

// After:
const body = await this._mergeBodyResolver.buildBody(number, modelEmail);
```

## Files to Change

- `core/lib/utils/github/MergeBodyResolver.js` — `buildBody`/`_coauthorsBody`/`_resolveMergerLogin` drop `repo`/`token` params, per above
- `core/spec/lib/utils/github/MergeBodyResolver_spec.js` — update to call `buildBody(number, modelEmail)` and stub the injected `githubClient`'s `getPrCommits(number)`/`getCurrentUser()` with the new no-repo/no-token signatures
