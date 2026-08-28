# Migrate ArcanumSplitIssuePushSubIssues

Depends on step 04: `ArcanumSplitIssueCreateSubIssue` now has the
`constructor(repoContext, …)` shape and `run(issueId, file)` signature.

## What to do

1. `core/lib/commands/ArcanumSplitIssuePushSubIssues.js`:
   - Constructor → `constructor(repoContext, { repoPathValidator = new RepoPath(),
     createSubIssue = new ArcanumSplitIssueCreateSubIssue(repoContext), readdir:
     readdirFn = readdir } = {})`. `repoContext` is the first positional, so it
     is in scope for the `createSubIssue` default. Store `this._repoContext =
     repoContext`; keep `this._createSubIssue`, `this._readdir`; rename
     `this._repoPath` → `this._repoPathValidator`.
   - `run(issueId)` — drop the leading `repoPath` parameter.
   - Presence guard → `if (!this._repoContext.repoPath || !issueId) throw new
     Error(USAGE)` (USAGE unchanged).
   - `await this._repoPathValidator.validate(this._repoContext.repoPath)`.
   - `_matchingFiles(issueId)` — drop its `repoPath` param, read
     `this._repoContext.repoPath` internally for `path.join(<repoPath>,
     ISSUES_DIR)`.
   - Per-file call → `output = await this._createSubIssue.run(issueId, file)`
     (was `.run(repoPath, issueId, file)`).
   - `_extractField`, the `${file}:${newId}` CSV, and the `DispatchFailure`
     catch/re-throw are unchanged.
   - Update class + method JSDoc.

2. `core/lib/core/commands.js` — `takesRepoContext: true` on
   `'arcanum-split-issue-push-sub-issues'`. This is the last of the four flips;
   `withFlag` now equals the final five-entry array (see step 06).

3. `core/spec/lib/core/commands_spec.js` — the `takesRepoContext` assertion now
   reaches its final form:
   `['arcanum-split-issue-create-sub-issue',
   'arcanum-split-issue-create-sub-issue-file', 'arcanum-split-issue-finish',
   'arcanum-split-issue-push-sub-issues', 'dispatch-fixture-repo-context']`.

4. `core/spec/lib/commands/ArcanumSplitIssuePushSubIssues_spec.js`:
   - `stubDeps()` → rename `repoPath` key to `repoPathValidator`; keep the fake
     `createSubIssue.run` spy.
   - Construct as `new ArcanumSplitIssuePushSubIssues({ repoPath: <tempDir> },
     stubDeps(...))` — plain `{ repoPath }` literal (the injected fake
     `createSubIssue` means `repoContext` is never forwarded in tests).
   - `instance.run(repoPath, ISSUE_ID)` → `instance.run(ISSUE_ID)`; the
     missing-repoPath case constructs with `{ repoPath: '' }`.
   - `deps.createSubIssue.run` call-argument assertions: `(issueId, file)`
     instead of `(repoPath, issueId, file)`.
   - No expected-output / stdout assertions change.

## Files to Change

- `core/lib/commands/ArcanumSplitIssuePushSubIssues.js` — constructor takes `repoContext` and forwards it into the `createSubIssue` default; `run` / `_matchingFiles` drop `repoPath`; per-file call is `run(issueId, file)`; `_repoPath` dep renamed `_repoPathValidator`.
- `core/lib/core/commands.js` — `takesRepoContext: true` on `arcanum-split-issue-push-sub-issues`.
- `core/spec/lib/core/commands_spec.js` — `takesRepoContext` assertion reaches its final five-entry form.
- `core/spec/lib/commands/ArcanumSplitIssuePushSubIssues_spec.js` — construct with `{ repoPath }` literal + renamed deps; drop `repoPath` from `run(...)`; assert `createSubIssue.run` with `(issueId, file)`.
