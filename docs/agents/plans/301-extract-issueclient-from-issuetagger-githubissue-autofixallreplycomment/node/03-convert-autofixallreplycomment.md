# Convert AutoFixAllReplyComment to RepoContext-bound

Convert `AutoFixAllReplyComment` (`core/lib/commands/AutoFixAllReplyComment.js`)'s comment-posting call to go through `IssueClient` instead of its own raw `fetch`. Unlike `IssueTagger`, this class's public `run(repoPath, id, agent, modelName, modelEmail, replyBody)` entrypoint keeps taking `repoPath` (it's a CLI-dispatched command, same shape as `AutoFixAllGithub`'s methods) — only its internal `_postComment` implementation changes.

Concretely:
- Add a private `_repoContext(repoPath)` (or reuse a per-call `IssueClient` build) mirroring `AutoFixAllGithub#_prOperations(repoPath)`/`SpawnIssue#_repoContext(repoPath)`.
- `_postComment(repo, prNumber, token, content)` → delegate to `this._issueClient(repoPath).postComment(prNumber, content)` (or equivalent), dropping the raw `fetch` call, `repo`, and `token` params — resolved via the per-call context instead.
- `run()`'s existing `const { repo } = await this._origin.resolve(repoPath); const token = await this._githubToken.get(repoPath);` lines become unnecessary for the comment-posting call specifically (still may be needed elsewhere in `run()` if anything else in the method uses `repo`/`token` directly — check before removing).
- Preserve the exact current error message (`Error: could not post comment on pull request #<prNumber> in <repo>`) and all other `run()` behavior (template rendering, push) unchanged.

## Files to Change

- `core/lib/commands/AutoFixAllReplyComment.js` — replace `_postComment`'s raw `fetch` with a delegation to a per-call `IssueClient`.
- `core/spec/commands/AutoFixAllReplyComment_spec.js` — update mocks for the new `_postComment` internals; assertions on `run()`'s external stdout/exit-code behavior should need no changes.
