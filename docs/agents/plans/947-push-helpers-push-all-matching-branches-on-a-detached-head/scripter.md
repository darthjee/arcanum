# Scripter Plan: Push helpers push all matching branches on a detached HEAD

Main plan: [plan.md](plan.md)

## Shared contracts

- Refusal message (stderr, exact): `refusing to push: no current branch (detached HEAD?)`
- `require_current_branch`: prints the branch name on stdout and returns `0`; on an empty name, prints the refusal on stderr and returns `1`.
- `push_current_branch`: uses `require_current_branch`, returns `1` without running `git push` on refusal; otherwise runs `git push -u origin "<b>:<b>"` (stdout unredirected, as today).
- Every entrypoint calls `require_current_branch` right after `repo_path_enter`, before any staging/commit/comment side effect. Refusal: non-zero exit, empty stdout.
- `monitor_pr_shell.sh` keeps `push_current_branch 2>/dev/null || true` unchanged.

## Implementation Steps

### Step 1 — Make `push.sh` strict
In `arcanum/_lib/push.sh`, add `require_current_branch` (resolves `git branch --show-current`; on empty output, prints the refusal to stderr and `return 1`; otherwise `printf '%s\n'` the name). Rewrite `push_current_branch` to obtain the branch through it (`branch=$(require_current_branch) || return 1`) and only then run `git push -u origin "${branch}:${branch}"`. Update the file header comment to describe the refusal and that callers wanting best-effort behaviour must tolerate the failure themselves.

### Step 2 — Check the branch before the first side effect in each entrypoint
Insert `require_current_branch >/dev/null` immediately after `repo_path_enter "$REPO_PATH"` (and after usage validation) in:
- `auto-plan-issue/scripts/commit_plan_shell.sh`: before the `[[ -d "$PLAN_DIR" ]]` check / `git add`. Placing it before the directory check is fine: both are failures, and the branch check is the cheaper precondition. Keep the order identical to the native side (see node step 02).
- `auto-new-issue/scripts/commit_issue_shell.sh`: before its file check / `git add`.
- `auto-fix-issue/scripts/commit_change_shell.sh`: before any staging/commit.
- `auto-fix-all/scripts/cleanup_artifacts_shell.sh`: before the `git rm` calls (so a detached HEAD fails even when there is nothing to clean up, as agreed in the issue).
- `auto-fix-all/scripts/reply_comment_shell.sh`: before `RESOLVE_PR_NUMBER` / `gh pr comment`.

`set -euo pipefail` makes the failing call exit the script non-zero. Do not touch `auto-monitor-pr/scripts/monitor_pr_shell.sh`.

## Files to Change
- `arcanum/_lib/push.sh`: add `require_current_branch`; make `push_current_branch` refuse an empty branch.
- `auto-plan-issue/scripts/commit_plan_shell.sh`: early branch check.
- `auto-new-issue/scripts/commit_issue_shell.sh`: early branch check.
- `auto-fix-issue/scripts/commit_change_shell.sh`: early branch check.
- `auto-fix-all/scripts/cleanup_artifacts_shell.sh`: early branch check.
- `auto-fix-all/scripts/reply_comment_shell.sh`: early branch check.

## CI Checks
- Shell scripts are exercised through the parity specs owned by node: `make core-test` (CI: core test job).
- Run `shellcheck` on the touched scripts locally if available.

## Notes
- The exact position of the check relative to each script's other precondition checks (directory/file existence) must match the native command's order, so error-path parity specs stay byte-identical. Coordinate with node step 02: the branch check goes **first**, right after usage validation and `repo_path_enter`.
