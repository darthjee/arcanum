# Unit tests for AutoFixAllCheckoutFromMain

`core/spec/lib/AutoFixAllCheckoutFromMain_spec.js`, following `SafeBranch_spec.js`'s two-layer style (stubbed-collaborator specs for `#run`'s short-circuit/error paths, plus a handful against a real `createGitFixtureRepo()` fixture for the actual git plumbing).

Cover:

- **Usage validation**: missing `repoPath` or `id` rejects with the `Usage: ...` error, before `repoPath.validate` or any `execFileAsync` call.
- **repo-path validation failure**: `repoPath.validate` rejecting short-circuits before any git call (mirrors `SafeBranch_spec.js`'s first `it`).
- **Fresh branch, no `origin/main`**: on a fixture repo, delete/rename `main`'s remote-tracking ref away (or point `origin` somewhere without a `main`) so `refs/remotes/origin/main` is absent — `run` creates `issue-<id>` from local `main`, resolves `BRANCH=issue-<id>\nSTATUS=ok\n`.
- **Fresh branch, `origin/main` present**: default fixture shape — `run` creates `issue-<id>` from `origin/main`, resolves the same success string.
- **Existing local branch, clean merge**: pre-create `issue-<id>` locally behind `origin/main` (push a new commit to the fixture's bare remote on `main`, on a file unrelated to any local changes on `issue-<id>`), assert `run` checks it out, merges cleanly, resolves `STATUS=ok`, and the merge commit is actually present (`git log` on `issue-<id>` includes the new `main` commit).
- **Remote-only branch (no local ref)**: push `issue-<id>` to the fixture's bare remote directly (skip creating it locally first) — `run` creates a local tracking branch from `origin/issue-<id>` before merging.
- **Conflict**: seed the fixture so `issue-<id>` and `origin/main` both modify the same line of the same file, then assert `run` rejects with a `DispatchFailure` whose `.exitCode` is `2` and whose `.stdout` is `BRANCH=issue-<id>\nSTATUS=conflict\n<conflicted-file>\n` — and that the working tree is left with conflict markers / the conflicted path shows as unmerged (`git diff --name-only --diff-filter=U`), i.e. no `git merge --abort` happened.
- **Tolerated missing-ref fetch failure**: stub `execFileAsync` so `git fetch origin main` (or `origin <branch>`) rejects with a stderr matching `couldn't find remote ref` (case-insensitive) — `run` proceeds rather than throwing.
- **Non-tolerated fetch failure**: stub `execFileAsync` so a `git fetch` rejects with an unrelated stderr — `run` rejects with `Error: git fetch origin main failed: <stderr>` (or the `<branch>` variant), matching the shell script's message text exactly.

## Files to Change

- `core/spec/lib/AutoFixAllCheckoutFromMain_spec.js` — new spec file, per the cases above.
