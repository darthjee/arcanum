# Update the three callers

Update every construction and call site of `IssueStatePaths` to match its new bare-positional
constructor and no-argument-`paths(id)` signature from step 01. This includes fixing
`GithubIssue.js`'s currently dead/unused zero-arg default, which would throw as soon as
`IssueStatePaths`'s constructor is called with `undefined`.

## Files to Change

- `core/lib/services/IssueStateService.js` — deps-default at the top of the constructor:
  `new IssueStatePaths({ repoContext: context })` → `new IssueStatePaths(context)`; its 3
  `.paths(undefined, id)` calls → `.paths(id)`.
- `core/lib/commands/shared/IssueState.js` — deps-default:
  `new IssueStatePaths({ repoContext })` → `new IssueStatePaths(repoContext)`; its
  `.paths(undefined, id)` call → `.paths(id)`.
- `core/lib/commands/shared/GithubIssue.js` — top-of-constructor dead default
  `issueStatePaths = new IssueStatePaths()` → `new IssueStatePaths(repoContext)`; the
  per-call instance built inside `_issueStateService()`,
  `new IssueStatePaths({ repoContext: context })` → `new IssueStatePaths(context)`.
