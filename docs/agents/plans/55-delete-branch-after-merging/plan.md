# Plan: Delete Branch After Merging

Issue: [55-delete-branch-after-merging.md](../issues/55-delete-branch-after-merging.md)

## Overview

After a PR is confirmed merged — whether by the script itself or detected by the monitor — the pipeline must delete the remote branch, check out `main`, and delete the local branch. This keeps the repository clean and leaves the working tree ready for `checkout_from_main.sh` to start the next issue. Two sub-tasks are needed: a script change (add `--delete-branch` to `cmd_pr_merge` and add a new `cleanup-branch` command), and a markdown update to `process_one_issue.md` to call cleanup on both merge paths.

## Agents involved

- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

`github.sh cleanup-branch <branch>` — new command in `auto-fix-all/scripts/github.sh`.

- **Input:** `<branch>` — the local branch name to delete (e.g. `issue-55`). Resolved from `git branch --show-current` before switching away.
- **Behaviour:**
  1. Attempt `git push origin --delete <branch>`; tolerate a non-zero exit (branch may already be deleted by GitHub's auto-delete setting).
  2. `git checkout main && git reset --hard origin/main`
  3. `git branch -D <branch>`
- **Output:** nothing on stdout (or a single status line is fine); exits 0 on success, non-zero on hard failures (e.g. `git checkout main` fails).
- **Added to `cmd_pr_merge`:** `gh pr merge` gains `--delete-branch` so GitHub deletes the remote atomically on the script-merge path. The local cleanup (checkout main, delete local branch) is still done explicitly via `cleanup-branch` for consistency.
