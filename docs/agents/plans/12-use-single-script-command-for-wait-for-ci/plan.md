# Plan: Use single script command for Wait for CI

Issue: [12-use-single-script-command-for-wait-for-ci.md](../../issues/12-use-single-script-command-for-wait-for-ci.md)

## Overview

Make `auto-fix-all/scripts/wait_ci.sh` resolve the current branch's PR number internally (same pattern used for `monitor_pr.sh`'s `monitor` form, issue #5), dropping its `<pr_number>` argument. Update `monitor_pr.md`'s "approved" branch to call it directly, without a separate `github.sh pr-number` call.

## Context

`wait_ci.sh` currently takes `<pr_number>` as its only positional arg and already duplicates the origin-resolution helpers (`_load_origin`, `get_repo_ref`) from `github.sh`, by this repo's no-cross-sourcing convention. The only caller is `auto-fix-all/steps/monitor_pr.md`'s "approved" branch, which calls it twice: once initially (after resolving `<pr_number>` via `scripts/github.sh pr-number`), and once again when looping back after a CI failure is fixed and re-pushed. Since this script always runs on the issue's own branch with an already-existing PR, resolving the PR number the same way `cmd_pr_number` (`github.sh`) and `monitor_pr.sh`'s `monitor` form already do is safe and sufficient — no need to keep backward compatibility with an explicit-argument form, since there are no other callers.

## Implementation Steps

### Step 1 — `auto-fix-all/scripts/wait_ci.sh`

Remove `PR_NUMBER="${1:-}"` and its usage-check. Instead, right after the existing origin helpers are defined (before the main polling loop), resolve:
```bash
branch=$(git branch --show-current)
repo_ref=$(get_repo_ref)
PR_NUMBER=$(gh pr view -R "$repo_ref" "$branch" --json number -q '.number' 2>/dev/null) || {
  echo "Error: no pull request found for the current branch on $repo_ref" >&2
  exit 1
}
[[ -n "$PR_NUMBER" ]] || {
  echo "Error: no pull request found for the current branch on $repo_ref" >&2
  exit 1
}
```
(mirroring `cmd_pr_number` in `github.sh` and the `monitor` form added to `monitor_pr.sh` for issue #5). The rest of the script (the check-runs polling loop using `$PR_NUMBER` and `$REPO_REF`) is unchanged. Update the top-of-file usage comment (`# Usage: wait_ci.sh <pr_number>`) to `# Usage: wait_ci.sh` (no arguments).

### Step 2 — `auto-fix-all/steps/monitor_pr.md`

In the "approved" branch:
- Remove the separate `scripts/github.sh pr-number` call and the `<pr_number>` resolution sentence; change the `wait_ci.sh` invocation to take no arguments.
- Update the "If CI failed" section's "go back to step 3 above (`wait_ci.sh`)" reference so it still reads correctly with the simplified single-call step.

### Step 3 — Manual verification

Run `scripts/wait_ci.sh` (no args) against a real branch with an open PR in this repo to confirm it resolves the PR number and reports `passed`/`failed` exactly as before.

## Files to Change

- `auto-fix-all/scripts/wait_ci.sh`
- `auto-fix-all/steps/monitor_pr.md`

## Notes

- No CI config exists in this repo; verification is manual, per Step 3.
- Self-contained script + prose work — no agent split needed.
