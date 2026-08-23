# pr-number, pr-state, cleanup-branch

Start `core/lib/AutoFixAllGithub.js` with the three simplest subcommands — no config-chain or label-mutation dependency, just cache lookup, REST reads, and plain `git` calls. Read `auto-fix-all/scripts/github.sh`'s `cmd_pr_number`, `cmd_pr_state`, and `cmd_cleanup_branch` for the exact output/exit-code contract.

- **`prNumber(repoPath)`**: current branch via `git branch --show-current` (`execFile`). If it matches `issue-<id>`, try `IssueState#get(repoPath, id, 'pr_id')` first (reuse the already-migrated `core/lib/IssueState.js` directly — do not re-derive the cache read) and return it if present. Otherwise (or if uncached) resolve the repo ref via `Origin.js`, fetch the open/most-recent PR for the branch via GitHub REST (`GET /repos/{repo}/pulls?head={owner}:{branch}` or equivalent), and print its number. No PR found → `Error: no pull request found for the current branch on <repo_ref>` to stderr, exit 1 (matches the shell's two identical error sites for "not found" and "empty").
- **`prState(repoPath)`**: same branch/repo-ref resolution, REST PR lookup, print `STATE=<OPEN|MERGED|CLOSED>` (GitHub's PR `state` field is `open`/`closed`; `merged` must be derived from the `merged`/`merged_at` field the same way `gh pr view --json state` does — verify against a real `gh pr view` JSON shape or existing fixture during implementation). Same not-found error message/exit code as `prNumber`.
- **`cleanupBranch(repoPath, id)`**: branch name `issue-<id>`. `git push origin --delete <branch>` (execFile, tolerate failure — matches the shell's `|| true`), then `git checkout main`, `git reset --hard origin/main`, `git branch -D <branch>` (all execFile, argument arrays, no string interpolation). No stdout on success, matching the shell version (it prints nothing).

## Files to Change

- `core/lib/AutoFixAllGithub.js` — new module; constructor takes injectable `{ origin, githubToken, issueState, execFileAsync, fetchFn }` collaborators (same DI shape as `GithubIssue.js`); implement `prNumber`, `prState`, `cleanupBranch` in this step (remaining methods added in later steps).
