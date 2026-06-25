# Plan: Remove issue json when the PR is merged

Issue: [73-remove-issue-json-when-the-pr-is-merged.md](../issues/73-remove-issue-json-when-the-pr-is-merged.md)

## Overview

When `monitor_pr.sh` detects that a PR has been merged, it should clean up the transient state file it was tracking before printing `"merged"` and exiting. Currently these files are left on disk indefinitely.

## Context

`monitor_pr.sh` uses one of two state files depending on how it is invoked:
- With `--issue-id <id>`: `.claude/state/issue-<id>.json` (unified per-issue state)
- Without `--issue-id`: `.claude/state/auto-monitor-pr-<pr_number>-comments.json` (deprecated legacy file)

On `MERGED`, both are no longer needed. On `CLOSED` the state is intentionally preserved because closed PRs may be reopened or retried.

## Implementation Steps

### Step 1 — Add cleanup in the MERGED branch of `monitor_pr.sh`

In `auto-monitor-pr/scripts/monitor_pr.sh`, locate the block:

```bash
if [[ "$state" == "MERGED" ]]; then
  echo "merged"
  exit 0
fi
```

Replace it with:

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

Both `rm -f` calls are silent when the file does not exist, so no guard is needed.

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr.sh` — add state-file cleanup in the `MERGED` branch before printing `"merged"`

## Notes

- Cleanup is intentionally limited to the `MERGED` branch. `CLOSED` is left untouched so the state survives a potential retry.
- `ISSUE_ID` is already in scope at the point of the change (parsed from `--issue-id`).
- `COMMENTS_FILE` is already in scope (set to `.claude/state/auto-monitor-pr-${PR_NUMBER}-comments.json`).
- No new variables, no new functions — the change is purely additive inside an existing branch.
