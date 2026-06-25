# Issue: Remove issue json when the PR is merged

## Description
When `monitor_pr.sh` detects that a PR has been merged, both transient state files created during the monitoring session are no longer needed and should be deleted to keep the `.claude/state/` directory tidy.

## Problem
After a PR is merged (including cases where it was pre-approved then merged), `monitor_pr.sh` exits immediately without cleaning up any state. Two files are left on disk indefinitely:
- `.claude/state/issue-<id>.json` — per-issue state (when `--issue-id` was given)
- `.claude/state/auto-monitor-pr-<pr_number>-comments.json` — per-PR comments file (when no issue ID was given)

These files accumulate over time with no mechanism to remove them.

## Expected Behavior
When `monitor_pr.sh` detects `state == MERGED`:
- If `--issue-id` was given: delete `.claude/state/issue-<id>.json` (no error if missing).
- If no issue ID was given: delete `.claude/state/auto-monitor-pr-<pr_number>-comments.json` (no error if missing).

Cleanup happens on MERGED only — CLOSED PRs may be reopened or the issue retried, so their state is preserved.

## Solution
In `monitor_pr.sh`, in the `$state == MERGED` branch, add the cleanup before `echo "merged"`:

```bash
if [[ "$state" == "MERGED" ]]; then
  if [[ -n "$ISSUE_ID" ]]; then
    rm -f ".claude/state/issue-${ISSUE_ID}.json"
  else
    rm -f "$COMMENTS_FILE"
  fi
  echo "merged"
  exit 0
fi
```
