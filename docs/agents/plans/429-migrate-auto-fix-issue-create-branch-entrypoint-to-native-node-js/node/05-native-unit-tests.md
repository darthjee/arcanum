# Native unit tests

Cover `AutoFixIssueCreateBranch` directly, following `AutoFixIssueCommitChange_spec.js`'s shape: construct the command with a dummy `repoContext` (`{ repoPath: ... }`) and injected fake collaborators (`execFileAsync`, filesystem access), no real `git`/disk I/O.

Cases to cover:
- Requested branch already exists locally → runs `git checkout <branch>` (not `-b`), returns the branch name.
- Requested branch doesn't exist locally → runs `git checkout -b <branch>`, returns the branch name.
- `plan.md` doesn't exist → falls back to `issue-<id>`.
- `plan.md` exists but has no `## Branch` section → falls back to `issue-<id>`.
- `plan.md` has a `## Branch` section with backticks/surrounding whitespace → extracts the branch name stripped of both.
- `plan.md` has a `## Branch` section whose extracted value is empty → falls back to `issue-<id>`.
- A `git` call rejects → the error propagates (surfaces as a thrown `Error`, not swallowed).

## Files to Change
- `core/spec/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` — new file, per the above.
