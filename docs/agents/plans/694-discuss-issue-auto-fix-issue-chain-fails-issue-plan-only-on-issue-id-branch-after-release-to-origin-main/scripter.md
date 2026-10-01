# Scripter Plan: discuss-issue → auto-fix-issue chain fails: issue/plan only on issue-<id> branch after release to origin/main

Main plan: [plan.md](plan.md)

## Shared contracts

- Remove the shell half of entrypoints `auto-fix-issue-create-branch` and `auto-fix-issue-merge-main`. Node removes the native half (`commands.js` registry entries and modules) in the same PR.
- `auto-fix-all/scripts/checkout_from_main.sh` and `arcanum/_lib/git_branch.sh` stay unchanged. `git_branch_merge_main` is still used by `checkout_from_main_shell.sh`.

## Implementation Steps

### Step 1 — Delete the shell scripts
Delete `auto-fix-issue/scripts/create_branch.sh`, `create_branch_shell.sh`, `merge_main.sh` and `merge_main_shell.sh`. Remove the `auto-fix-issue-create-branch` and `auto-fix-issue-merge-main` keys from `arcanum/_lib/migration-status.json`, keeping the JSON valid.

### Step 2 — Fix comment references
Update the header comments in `auto-fix-issue/scripts/github.sh`, `list_plan_agents.sh` and `list_plan_steps.sh` that compare themselves to `create_branch.sh`. Point them at a remaining sibling, such as `commit_change.sh`, or drop the comparison. Grep `arcanum/_lib` and `*/scripts` for any other `create_branch` / `merge_main` mention, ignoring `git_branch_merge_main`.

## Files to Change
- `auto-fix-issue/scripts/create_branch.sh`, `create_branch_shell.sh`, `merge_main.sh`, `merge_main_shell.sh` — deleted.
- `arcanum/_lib/migration-status.json` — drop the two entrypoint keys.
- `auto-fix-issue/scripts/github.sh`, `list_plan_agents.sh`, `list_plan_steps.sh` — comment-only updates.

## Notes
- Check whether `scripts/` or the release-zip build (`.circleci/config.yml` build-and-release) lists files explicitly. If it does, drop the deleted scripts from it.
