# Extract IssueStatePaths

Pull `IssueState`'s `_paths(repoPath, id)` private method into `core/lib/utils/file/IssueStatePaths.js`, alongside `RepoPath.js` — it's a path-resolution concern, not a JSON one, so it does not belong in `utils/json/` (Step 01).

Name it `IssueStatePaths`, not `IssueFilePaths` — that name would collide with the unrelated `core/lib/utils/file/IssueFile.js`, which handles docs-issue markdown file lookup (`docs/agents/issues/<id>-*.md`), a completely different concern from the `.claude/state/issue-<id>.json` paths this class resolves.

Copy the method body verbatim as a public instance method, e.g. `paths(repoPath, id)`, returning the same `{ stateDir, stateFile, lockFile }` shape. Write a full spec with 100% coverage.

## Files to Change

- `core/lib/utils/file/IssueStatePaths.js` — new, `paths(repoPath, id)`.
- `core/spec/lib/utils/file/IssueStatePaths_spec.js` — new.
