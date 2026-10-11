# Declare docker needs in batch-4 shims

Add the `--needs=...` value from the plan's shared-contracts table to each of the 10 shims' `engine_dispatch` calls, plus `--path-arg=<n>` for any argument that is a path outside the repo. Add a short docker paragraph to each shim header, like the batch-3 shims, saying which mounts/env the command gets under `engine.mode=docker` (worded as "once its status is docker"). Do not change any status yet.

Check each shell twin for remote operations or `gh` calls not reflected in its checklist row. If a row is wrong, fix its `credentials`/`mounts`/`env` cells in `docs/agents/specs/docker/checklist.md` in the same commit and say so in the commit message.

## Files to Change

- `arcanum-split-issue/scripts/finish.sh`
- `auto-fix-all/scripts/checkout_from_main.sh`
- `auto-fix-all/scripts/cleanup_artifacts.sh`
- `auto-fix-all/scripts/github.sh` (`cleanup-branch` only)
- `auto-fix-all/scripts/reply_comment.sh`
- `auto-fix-issue/scripts/commit_change.sh`
- `auto-monitor-pr/scripts/monitor_pr.sh`
- `auto-new-issue/scripts/commit_issue.sh`
- `auto-plan-issue/scripts/commit_plan.sh`
- `arcanum/_lib/checkout_safe_branch.sh`
- `docs/agents/specs/docker/checklist.md`: only if a row's columns need fixing
