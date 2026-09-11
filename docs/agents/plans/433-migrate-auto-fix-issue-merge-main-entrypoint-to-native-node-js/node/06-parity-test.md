# Parity test

Create `core/spec/bin/autoFixIssueMergeMainParity_spec.js`, mirroring `autoFixIssueCreateBranchParity_spec.js`'s shape: run `auto-fix-issue/scripts/merge_main_shell.sh` directly (NOT through the `merge_main.sh` shim, to keep the test non-circular) and `core/bin/arcanum auto-fix-issue-merge-main` against equivalent fixture-repo inputs, asserting byte-identical stdout and exit code on both sides.

Use `createGitFixtureRepo` (`core/spec/support/utils/gitFixtureRepo.js`) to build the local repo + local `origin` remote (no network involved), then build these scenarios on top of it — running each scenario against a **fresh** fixture repo/branch for shell vs. native (both sides must start from identical repo state):

- **No-op** (`origin/main` unchanged since clone): both sides print `STATUS=ok` and exit 0.
- **Clean merge**: push a new, non-conflicting commit to the fixture's `origin/main` (a second file, or an edit elsewhere), then run the script from a branch with its own unrelated change — both sides print `STATUS=ok`, exit 0, and the merge actually lands (verify via `git log`/file presence, same as the create-branch parity test verifies its own side effect).
- **Conflict**: push a commit to `origin/main` that edits the same line/file as an uncommitted-then-committed local change on the current branch, so the merge genuinely conflicts — both sides print `STATUS=conflict` followed by the same conflicted-file list (order matters — `git diff --name-only --diff-filter=U`'s output order must match), and both exit 2. Also assert the working tree is left with conflict markers on both sides (neither ran `git merge --abort`).

## Files to Change

- `core/spec/bin/autoFixIssueMergeMainParity_spec.js` — new file, parity test as described above.
