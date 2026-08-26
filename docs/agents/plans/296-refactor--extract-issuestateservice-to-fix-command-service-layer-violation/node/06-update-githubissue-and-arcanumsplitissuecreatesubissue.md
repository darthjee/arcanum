# Update GithubIssue and ArcanumSplitIssueCreateSubIssue

Both `GithubIssue` and `ArcanumSplitIssueCreateSubIssue` currently import `IssueState` directly and call its CRUD methods with an explicit `repoPath` argument. Give both the same per-call-builder treatment as `IssueState.js` itself (Step 04's `_issueStateService(repoPath)` helper).

### GithubIssue — core/lib/commands/GithubIssue.js

- Remove `import IssueState from './IssueState.js'`; import `IssueStateService` from `../services/IssueStateService.js` and `RepoContext` from `../context/RepoContext.js`.
- Replace the constructor's `issueState = new IssueState()` dependency with `IssueStateService`'s own injectable collaborators — `lock`, `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths` (same defaults `IssueStateService` uses).
- Add a private `_issueStateService(repoPath)` helper identical in shape to `IssueState.js`'s (Step 04).
- In `#fetch`, change `await this._issueState.write(repoPath, id, { tags, updated_at: updatedAt, title, state });` to `await this._issueStateService(repoPath).write(id, { tags, updated_at: updatedAt, title, state });`.

Update `core/spec/lib/commands/GithubIssue_spec.js`:
- `stubDeps`'s `issueState: { write: jasmine.createSpy(...) }` fake is no longer meaningful — there is no single seam left to fake at that granularity (the real `IssueStateService`'s file I/O lives several layers deeper). Remove it.
- The spec already creates a real temp `repoPath` (`createTempDir`) for the docs-issue-file assertions. In the tests that currently assert `expect(issueState.write).toHaveBeenCalledWith(repoPath, '321', {...})` / `.not.toHaveBeenCalled()`, instead read back `.claude/state/issue-<id>.json` under that same temp `repoPath` and assert its parsed JSON content matches `{ tags, updated_at, title, state }` (or that the file is absent, for the "does not call issueState.write" case).

### ArcanumSplitIssueCreateSubIssue — core/lib/commands/ArcanumSplitIssueCreateSubIssue.js

- Remove `import IssueState from './IssueState.js'`; import `IssueStateService` and `RepoContext` the same way.
- Replace the constructor's `issueState = new IssueState()` dependency with the same `IssueStateService` collaborators as above.
- Add the same private `_issueStateService(repoPath)` helper.
- Change `await this._issueState.appendJson(repoPath, issueId, SUB_ISSUES_FIELD, JSON.stringify(newId));` to `await this._issueStateService(repoPath).appendJson(issueId, SUB_ISSUES_FIELD, JSON.stringify(newId));`.

Update `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js` the same way: remove `stubDeps`'s `issueState: { appendJson: spy }` fake, and in the 3 places asserting on `deps.issueState.appendJson`, instead read back `.claude/state/issue-<issue_id>.json` under the spec's existing temp `repoPath` and assert the `sub-issues` field's content (or that it's absent/unappended, for the negative cases).

## Files to Change

- `core/lib/commands/GithubIssue.js`
- `core/spec/lib/commands/GithubIssue_spec.js`
- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js`
