# Remove repoPath from findExisting

The issue's **Phase 3**. Every call site now constructs `new IssueFile(repoContext)` and
passes `undefined` for `findExisting`'s `repoPath`, so the parameter and its Phase-1
fallback are dead weight. Delete them; `repoContext` becomes the sole, required source of
`repoPath`.

## What to do

### `core/lib/utils/file/IssueFile.js`

1. `findExisting(issuesFolder, id)` — drop the leading `repoPath` parameter and the
   `repoPath ?? this._repoContext?.repoPath` fallback. Read the path directly:
   `const { repoPath } = this._repoContext;` (mirrors `RepoConfig.js` after its own
   Phase 3). Body otherwise unchanged.
2. `repoContext` is now **required** at construction. Match `RepoConfig.js` — no explicit
   guard/throw; a missing `repoContext` will fail naturally on the destructure. (If parity
   with `BranchCleanup.js`'s usage guard is preferred, a `if (!this._repoContext?.repoPath)
   throw` at the top of `findExisting` is acceptable, but it is not required and there is
   no prior guard on this method to preserve.)
3. JSDoc: drop the `@param {string} repoPath ...` line from `findExisting`; change the
   constructor's `[repoContext]` to a required `repoContext`, describing it as the sole
   source of `repoPath`.

### Call sites

- `ResolveAndFetch.js`, `ResolvePlanPaths.js`, `ResolveIdAndFile.js` — drop the
  `undefined` first argument: `findExisting(issuesFolder, id)`. No other change (they
  already construct with `repoContext`).

### `core/spec/lib/utils/file/IssueFile_spec.js`

1. Remove the per-call-`repoPath` `#findExisting` cases and the explicit-`repoPath`-wins
   case added in Step 01 — that calling style no longer exists.
2. All remaining `#findExisting` cases construct
   `new IssueFile(createRepoContextMock({ repoPath }))` (the spec's temp dir) and call
   `issueFile.findExisting(issuesFolder, id)`.
3. `#titleFromFilename` cases construct `new IssueFile(createRepoContextMock())` (bare —
   the method ignores `repoPath`, the mock's `/fake/repo` default is irrelevant) and call
   `issueFile.titleFromFilename(...)`.

## Files to Change

- `core/lib/utils/file/IssueFile.js` — `findExisting` loses its `repoPath` param and
  fallback, reads `this._repoContext.repoPath`; `repoContext` required; JSDoc updated.
- `core/lib/commands/shared/ResolveAndFetch.js`,
  `core/lib/commands/shared/ResolvePlanPaths.js`,
  `core/lib/commands/shared/ResolveIdAndFile.js` — `findExisting(issuesFolder, id)` (drop
  the `undefined` arg).
- `core/spec/lib/utils/file/IssueFile_spec.js` — drop per-call-`repoPath` cases; every
  example constructs via `createRepoContextMock`.
