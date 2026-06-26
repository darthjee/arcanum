# Scripter Plan: Deprecate auto-monitor-issue-pr and auto-monitor-pr skills

Main plan: [plan.md](plan.md)

## Shared contracts

- **New script:** `auto-fix-all/scripts/monitor_pr.sh`
  - Interface: `scripts/monitor_pr.sh --pr-number <pr_number> --issue-id <id>`
  - Copy of `auto-monitor-pr/scripts/monitor_pr.sh` — all internal relative paths remain the same (`../../_lib/origin.sh`, `../../_lib/push.sh`, `../../auto-fix-issue/scripts/issue_state.sh`), since `auto-fix-all/scripts/` is at the same depth as `auto-monitor-pr/scripts/`.
- **PR number resolution in `reply_comment.sh`:** use `"$SCRIPT_DIR/github.sh" pr-number` (no arguments) instead of the old `"$RESOLVE_PR_NUMBER" "$ID"` pattern.

## Implementation Steps

### Step 1 — Create auto-fix-all/scripts/monitor_pr.sh

Copy `auto-monitor-pr/scripts/monitor_pr.sh` verbatim to `auto-fix-all/scripts/monitor_pr.sh`.

Verify that all relative source paths resolve correctly from the new location:
- `../../_lib/origin.sh` → same depth, same target — no change needed.
- `../../_lib/push.sh` → same depth, same target — no change needed.
- `../../auto-fix-issue/scripts/issue_state.sh` → same depth, same target — no change needed.

Make the script executable: `chmod +x auto-fix-all/scripts/monitor_pr.sh`.

### Step 2 — Update auto-fix-all/scripts/reply_comment.sh

Remove the line:
```bash
RESOLVE_PR_NUMBER="$SCRIPT_DIR/../../auto-monitor-issue-pr/scripts/resolve_pr_number.sh"
```

Change the PR number resolution from:
```bash
PR_NUMBER=$("$RESOLVE_PR_NUMBER" "$ID")
```
to:
```bash
PR_NUMBER=$("$SCRIPT_DIR/github.sh" pr-number)
```

The `<id>` argument is no longer passed (the existing `github.sh pr-number` command infers the branch from `git branch --show-current`, same as the old `resolve_pr_number.sh`).

## Files to Change

- `auto-fix-all/scripts/monitor_pr.sh` — new file (copied from `auto-monitor-pr/scripts/monitor_pr.sh`)
- `auto-fix-all/scripts/reply_comment.sh` — remove cross-skill reference; use `github.sh pr-number`

## Notes

- No CI checks configured for this project.
- The architect handles the directory deletions and markdown updates after the scripter commits.
