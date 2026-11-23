## Description
Every "push the current branch" helper resolves the branch with `git branch --show-current` and then runs `git push -u origin "${branch}:${branch}"`. On a **detached HEAD**, `--show-current` prints nothing, so the command becomes `git push -u origin :`. The `:` refspec means "push all *matching* branches": git tries to push every local branch that has a same-named branch on `origin`, including the default branch, instead of failing.

The commit step also runs **before** any branch check, so the commit lands on the detached HEAD (where it ends up on no branch) before the push fails.

## How it was found
`/auto-plan-issue 940` was run on its own after `/discuss-issue 940` took the push-only path, so no `issue-940` branch existed and the repo sat on the safe branch (detached `origin/main`). `commit_plan.sh` committed the plan as `971245d` on the detached HEAD, then ran `git push -u origin :`. The push was rejected as non-fast-forward against `main`, so nothing reached the remote. That rejection was luck: if a local `main` (or any other matching branch) had been ahead of `origin`, it would have been pushed. The commit had to be recovered by hand onto `issue-940`.

## Problem
- A detached HEAD silently turns a "push this branch" into "push all matching branches", which can update `main` or unrelated branches on the remote.
- The commit is created before the branch is validated, which leaves commits on no branch when the push fails.

## Affected code
The same logic is duplicated across the shell helper and several native copies:
- `arcanum/_lib/push.sh` (`push_current_branch`, used by `*_shell.sh` scripts such as `auto-plan-issue/scripts/commit_plan_shell.sh`)
- `core/lib/utils/git/GitClient.js` (`pushCurrentBranch`, used by `AutoMonitorPrMonitorPr.js`)
- `_pushCurrentBranch` private copies in:
  - `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`
  - `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`
  - `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js`
  - `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js`
  - `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`

## Expected Behavior
- When the current branch name is empty (detached HEAD), every push helper **refuses** with a clear error (`refusing to push: no current branch (detached HEAD?)`) and a non-zero exit. It never runs `git push` with an empty refspec.
- Commit-then-push entrypoints (`commit_plan`, `commit_issue`, `commit_change`, `cleanup_artifacts`) and `reply_comment` (which posts a comment, then pushes) check the branch **before their first side effect** (staging, committing or posting a comment), so a detached HEAD fails without leaving a commit, a staged index or a posted comment behind.

## Scope

**In scope**
- **Core guard:** every push helper (`arcanum/_lib/push.sh`'s `push_current_branch` and the native helper) refuses to push when the current branch name is empty (detached HEAD), and never runs `git push` with an empty refspec. Every commit-then-push entrypoint (`commit_plan`, `commit_issue`, `commit_change`, cleanup-artifacts and reply-comment commits) checks the branch **before** `git commit`, so a detached HEAD leaves no orphan commit.
- **Consolidation:** the five private `_pushCurrentBranch` copies (`AutoPlanIssueCommitPlan`, `AutoNewIssueCommitIssue`, `AutoFixIssueCommitChange`, `AutoFixAllCleanupArtifacts`, `AutoFixAllReplyComment`) are replaced by a single shared helper under `core/lib/utils/git/` (on `GitClient` or a small dedicated util), so the guard lives in one place. Their specs move from stubbing `git branch --show-current`/`git push` directly to the shared helper.

**Out of scope**
- **Stricter branch contract:** refusing when the current branch isn't `issue-<id>`, or refusing to push the default branch. This is a policy change rather than a bug fix, and can follow up separately.
- **Standalone `/auto-plan-issue` branch handling:** whether it should create or check out `issue-<id>`, or fail early, is tracked in its own issue (see Related). With this fix in place it already fails safely: no commit, no push.

## Strict vs. best-effort contract

Only one caller treats the push as best-effort today. The rest are strict:

| Caller | Current contract |
|---|---|
| `commit_plan`, `commit_issue`, `commit_change`, `cleanup_artifacts`, `reply_comment` (shell + native) | **Strict**: a failed push propagates (non-zero exit / thrown error), and `git push`'s stdout is relayed as part of the output |
| `monitor_pr` (`push_current_branch 2>/dev/null \|\| true` / `GitClient#pushCurrentBranch`) | **Best-effort**: every failure is swallowed |

`GitClient#pushCurrentBranch`'s doc comment, which claims every caller of the shell function tolerates any failure, is inaccurate and must be corrected.

**Decision**
- **One strict primitive** in `core/lib/utils/git/` (on `GitClient`):
  - `requireCurrentBranch()` (name indicative) returns the current branch name, or throws `refusing to push: no current branch (detached HEAD?)` when it is empty. Entrypoints call it before their first side effect (see Edge cases).
  - `pushCurrentBranch()` uses the same check, then runs `git push -u origin <branch>:<branch>` and returns its stdout. It throws on failure; it is no longer best-effort.
- **Best-effort is the caller's responsibility**, not a helper mode. `AutoMonitorPrMonitorPr` wraps the call in its own `try/catch`, and `monitor_pr_shell.sh` keeps its `|| true`.
- **Shell parity:** `arcanum/_lib/push.sh`'s `push_current_branch` becomes strict in the same way. On an empty branch it prints the refusal to stderr and returns `1` without calling `git push`. A matching `require_current_branch` shell function is used by the `*_shell.sh` entrypoints before committing.
- **Monitor behaviour on a detached HEAD:** the refusal is swallowed silently, consistent with today's best-effort handling. The only change is that nothing gets pushed.

**Rejected alternatives**
- `pushCurrentBranch({ bestEffort: true })`: a boolean mode flag hides the contract difference at the call site, and only one caller would use it.
- Returning a status object instead of throwing: it breaks the five strict callers' existing throw/exit semantics.

## Edge cases

- **Placement of the branch check: before the first side effect, not just before `git commit`.** Several entrypoints change state before committing: `commit_plan`/`commit_issue` run `git add`, `cleanup_artifacts` runs `git rm`, and `reply_comment` posts the PR comment and then pushes without committing. A refusal at commit or push time would leave a staged-but-uncommitted index on the detached HEAD (which then breaks the next safe-branch checkout on a dirty tree), or a comment already posted. Every entrypoint therefore calls `requireCurrentBranch` / `require_current_branch` right after argument validation, before any `git add`/`git rm`, commit or comment post. As a consequence, `cleanup_artifacts` on a detached HEAD with nothing to clean up now fails instead of being a no-op. That is acceptable, since it only ever runs on the issue branch.
- **Empty branch name for other reasons** (mid-rebase/bisect, `git` older than 2.22 without `--show-current`): all of these yield an empty name and are covered by the same guard. The message avoids asserting the cause: `refusing to push: no current branch (detached HEAD?)`.
- **Unborn branch** (fresh repo, no commits): `--show-current` still prints the name, so the guard passes. No change.
- **Branch with no upstream yet:** `git push -u` already sets it. No change.
- **Refspec safety:** git branch names cannot contain `:`, so `<branch>:<branch>` is safe once the name is non-empty.
- **Monitor:** its caller-side best-effort handling swallows the refusal, so a detached HEAD there simply means "no push".

## Testing strategy

**1. Helper unit specs** (`core/spec/lib/utils/git/GitClient_spec.js`)
- `requireCurrentBranch` returns the trimmed branch name, and throws `refusing to push: no current branch (detached HEAD?)` on empty output.
- `pushCurrentBranch` on an empty branch throws and never calls `git push` (the stub asserts no push call). Otherwise it pushes `<branch>:<branch>` and returns stdout. A push failure now propagates, replacing the existing "swallows failures" expectation.

**2. Command unit specs** (`AutoPlanIssueCommitPlan`, `AutoNewIssueCommitIssue`, `AutoFixIssueCommitChange`, `AutoFixAllCleanupArtifacts`, `AutoFixAllReplyComment`, `AutoMonitorPrMonitorPr`)
- Detached HEAD (the stubbed helper throws): the command rejects, and no `git add`/`git rm`/commit/comment-post call is made. This locks in the "check before the first side effect" ordering.
- Happy paths are unchanged, except that the specs stub the shared helper instead of raw `git branch --show-current` / `git push` calls.
- `AutoMonitorPrMonitorPr`: when `pushCurrentBranch` throws, the command still resolves normally.

**3. Parity specs** (`core/spec/bin/*Parity*`, real git fixtures, shell vs. native)
- Each of the five commit/reply parity specs gains a detached-HEAD case. Both engines produce identical stdout, stderr and non-zero exit code, and leave HEAD unchanged (`git rev-parse HEAD` before/after), the index and working tree untouched (`git status --porcelain` before/after), and remote refs unchanged.
- Monitor parity: on a detached HEAD, both sides succeed with identical output and push nothing.

**4. Regression test for the incident**
- A fixture with a bare `origin`, a local `main` one commit ahead of `origin/main`, and a detached HEAD. Running `commit_plan` leaves `origin`'s `main` unchanged. This is the exact scenario where the bug would have pushed `main`. If `createGitFixtureRepo` lacks bare-remote support, extend it.

**Not planned:** a standalone shell test harness (e.g. bats). The shell side is covered through the parity specs, as elsewhere in the repo.

## Backward compatibility

| Flow | Branch at commit time | Effect of the fix |
|---|---|---|
| `/auto-resolve-issue`, `/auto-fix-all` (nested new/plan/fix, cleanup, replies) | `issue-<id>` (via `checkout_from_main.sh`) | None |
| `/discuss-issue` and `/plan-issue` plan-it / push-only paths | `issue-<id>` (via `checkout_from_main.sh`) | None |
| `/auto-monitor-pr` push | issue branch, best-effort | None (on a detached HEAD it silently pushes nothing) |
| Standalone `/auto-plan-issue <id>` | detached safe branch | Now fails loudly before staging (tracked in #949) |
| Standalone `/auto-new-issue` | detached safe branch (it never checks out a branch itself) | Now fails loudly before staging (tracked in #949) |

- Both standalone flows currently commit on the detached HEAD and run `git push origin :`. After this fix they fail safely through their existing "fail with `commit_*.sh`" paths. Making them usable standalone again (create or check out `issue-<id>`, or fail early with guidance) is decided in #949.
- `GitClient#pushCurrentBranch` now throws. Its only caller (`AutoMonitorPrMonitorPr`) wraps it in `try/catch`, and its doc comment is corrected.
- `cleanup_artifacts` no longer no-ops on a detached HEAD. This is harmless, since it only runs on `issue-<id>`.
- No config, data or CLI-argument changes. The only new behaviour is a stderr message and a non-zero exit. Skill markdown already routes a non-zero exit through its "fail with" paths, so no skill-doc changes are needed.

## Other considerations

- **Alternative solutions:** covered under "Strict vs. best-effort contract". A `bestEffort` mode flag and a status-object return were both rejected.
- **Security:** the fix closes an accidental push to the default branch or unrelated branches through the empty `:` refspec. Explicitly refusing to push the default branch is out of scope (see Scope).
- **Migration needed?** No. This is internal helper behaviour with no repo-side files or config shape changes.
- **Script-driven interaction?** N/A. No prompts are involved.
- **New root-level folder?** N/A.

## Solution (suggested)
- Make the native helper the single implementation: have the `_pushCurrentBranch` copies call `GitClient#pushCurrentBranch` (or one shared util), and make that helper throw on an empty branch name.
- Add the same guard to `arcanum/_lib/push.sh`'s `push_current_branch` for shell-engine parity.
- Move the branch check ahead of the first side effect (`git add`/`git rm`, commit, PR comment) in each entrypoint.
- Tests: see Testing strategy.

## Related
- #949: standalone `/auto-plan-issue <id>` and `/auto-new-issue` (not nested from a pipeline) have no `issue-<id>` branch to commit to. Whether it should create or check out the branch itself, or fail early, is decided there.
