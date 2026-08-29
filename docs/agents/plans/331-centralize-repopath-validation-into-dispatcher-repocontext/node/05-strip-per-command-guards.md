# Remove the per-command guard and RepoPath dependency from the 13 modules

For each module below: delete the `await this._repoPathValidator.validate(...)` /
`await this._repoPath.validate(...)` line from `run()` (or the relevant method),
remove the `RepoPath` import, and remove the `repoPathValidator` / `repoPath`
constructor `deps` entry (and its `this._…` assignment and JSDoc `@param`). Leave
each command's own arg-arity `USAGE` throw exactly as-is — only the validation
line goes.

Modules that validate today (guard removed):

- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js` (`:83`, dep
  `repoPathValidator`)
- `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js` (`:63`,
  `repoPathValidator`)
- `core/lib/commands/ArcanumSplitIssueFinish.js` (`:82`, `repoPathValidator`)
- `core/lib/commands/ArcanumSplitIssuePushSubIssues.js` (`:67`,
  `repoPathValidator`)
- `core/lib/commands/AutoFixAllCheckoutFromMain.js` (`:57`, `repoPath`)
- `core/lib/commands/AutoFixAllCleanupArtifacts.js` (`:119`, `repoPath`)
- `core/lib/commands/AutoFixAllWaitCi.js` (`:93`, `repoPathValidator`)
- `core/lib/commands/AutoFixAllWaitCiAndMerge.js` (`:55`, `repoPathValidator`)
- `core/lib/commands/SafeBranch.js` (`:49`, `repoPath`)
- `core/lib/commands/GithubIssue.js` — `create()` only (`:165`, `repoPath`);
  `info()` already does not validate. Remove the `RepoPath` import + dep since
  `create` was its only user. The `RepoContext#createIssue` collaborator path is
  covered by step 04.
- `core/lib/commands/IssueState.js` (`:86`, `repoPath`)
- `core/lib/commands/ListAgents.js` (`:45`, `repoPath`)
- `core/lib/commands/SpawnIssue.js` (`:98`, `repoPathValidator`)

Surfaces that do NOT validate today — they gain the guard automatically via
step 03's Dispatcher call (their `*_shell.sh` counterparts already call
`repo_path_enter`). No code change needed here beyond confirming they carry no
stale half-guard:

- `core/lib/commands/AutoFixAllGithub.js` (7 subcommands)
- `core/lib/commands/AutoFixAllReplyComment.js`
- `core/lib/commands/ResolveAndFetch.js`
- `core/lib/commands/ResolveIdAndFile.js`
- `core/lib/commands/ResolvePlanPaths.js`

After the edits, grep the tree to confirm `RepoPath` is imported only by
`RepoContext.js` (step 01) and its own spec.

## Files to Change

- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js` — drop validate line +
  `RepoPath` import + `repoPathValidator` dep.
- `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js` — same.
- `core/lib/commands/ArcanumSplitIssueFinish.js` — same.
- `core/lib/commands/ArcanumSplitIssuePushSubIssues.js` — same.
- `core/lib/commands/AutoFixAllCheckoutFromMain.js` — drop validate line +
  `RepoPath` import + `repoPath` dep.
- `core/lib/commands/AutoFixAllCleanupArtifacts.js` — same.
- `core/lib/commands/AutoFixAllWaitCi.js` — drop validate line + import +
  `repoPathValidator` dep.
- `core/lib/commands/AutoFixAllWaitCiAndMerge.js` — same.
- `core/lib/commands/SafeBranch.js` — drop validate line + import + `repoPath`
  dep.
- `core/lib/commands/GithubIssue.js` — drop `create()`'s validate line +
  `RepoPath` import + `repoPath` dep + JSDoc `@param`.
- `core/lib/commands/IssueState.js` — drop validate line + import + `repoPath`
  dep.
- `core/lib/commands/ListAgents.js` — same.
- `core/lib/commands/SpawnIssue.js` — drop validate line + import +
  `repoPathValidator` dep.
