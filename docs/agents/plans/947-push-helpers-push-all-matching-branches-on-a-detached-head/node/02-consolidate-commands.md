# Consolidate the commit/reply commands onto GitClient
In each of these commands, delete the private `_pushCurrentBranch` method and inject a `GitClient` instead. Add a `gitClient` constructor dependency defaulting to `new GitClient({ context: repoContext, execFileAsync })`, so the command's own injected `execFileAsync` still drives every git call in unit specs.

- `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`
- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`
- `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js`
- `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js`
- `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`. It currently runs `git -C <repoPath> …` without `cwd`; `GitClient` uses `cwd: repoPath`, which is equivalent.

In each `run`, call `await this._gitClient.requireCurrentBranch()` right after argument validation, before any other precondition check that touches the repo (directory/file existence), `git add`/`git rm`, commit, PR-number resolution or comment post. The order must match scripter step 2 so error-path parity holds. Replace the old `_pushCurrentBranch(...)` call with `await this._gitClient.pushCurrentBranch()`, keeping its stdout concatenated into the returned output exactly as before.

Update each command's unit spec (`core/spec/lib/commands/...`):
- Happy path: output unchanged (commit stdout + push stdout).
- Detached HEAD (`branch --show-current` returns empty, or a stubbed `gitClient.requireCurrentBranch` rejects): `run` rejects with the refusal message, and no `git add`/`git rm`/`git commit`/`git push`/comment call was made.
- `AutoFixAllCleanupArtifacts`: detached HEAD with nothing to clean up now rejects (no longer returns `''`).

## Files to Change
- `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`: inject `GitClient`, early check, drop `_pushCurrentBranch`.
- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`: same.
- `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js`: same.
- `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js`: same.
- `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`: same (check before PR-number resolution and comment post).
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`, and the matching specs of the other four commands: detached-HEAD cases and updated stubs.
