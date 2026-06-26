# Plan: Deprecate auto-monitor-issue-pr and auto-monitor-pr skills

Issue: [80-deprecate-auto-monitor-issue-pr-and-auto-monitor-pr-skills.md](../issues/80-deprecate-auto-monitor-issue-pr-and-auto-monitor-pr-skills.md)

## Overview

Both `auto-monitor-issue-pr/` and `auto-monitor-pr/` skill directories will be deleted. Their only consumer is `auto-fix-all`. The sole script with unique logic — `auto-monitor-pr/scripts/monitor_pr.sh` — is copied to `auto-fix-all/scripts/monitor_pr.sh`. References in `process_one_issue.md` and `reply_comment.sh` are updated to the new local paths. Documentation files that mention either skill are updated or cleaned up.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

### monitor_pr.sh destination

- **Path:** `auto-fix-all/scripts/monitor_pr.sh`
- **Interface (unchanged):** `scripts/monitor_pr.sh --pr-number <pr_number> --issue-id <id>`
- **Relative path references inside the script** (all unchanged from source):
  - `../../_lib/origin.sh`
  - `../../_lib/push.sh`
  - `../../auto-fix-issue/scripts/issue_state.sh`

### PR number resolution

- Resolved via the already-existing command: `scripts/github.sh pr-number`
  (prints the PR number for the current branch, no arguments needed)
- `reply_comment.sh` switches from `../../auto-monitor-issue-pr/scripts/resolve_pr_number.sh <id>` to `"$SCRIPT_DIR/github.sh" pr-number` (drops the `<id>` argument, which `github.sh pr-number` does not accept).
