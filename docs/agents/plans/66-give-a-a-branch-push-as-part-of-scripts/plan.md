# Plan: Give a branch push as part of scripts

Issue: [66-give-a-a-branch-push-as-part-of-scripts.md](../issues/66-give-a-a-branch-push-as-part-of-scripts.md)

## Overview

Create a shared `_lib/push.sh` helper that exposes a `push_current_branch` function resolving the current branch via `git branch --show-current` and running `git push -u origin <branch>:<branch>`. Source this helper and call it immediately after every `git commit` in the commit scripts (`commit_change.sh`, `commit_issue.sh`, `commit_plan.sh`, `cleanup_artifacts.sh`). Also call it defensively in `reply_comment.sh` and at the start of `monitor_pr.sh`'s polling loop. Once the scripts push reliably, remove the now-redundant standalone `git push` steps from three markdown skill files.

## Agents involved

- [scripter](scripter.md)

## Shared contracts

`_lib/push.sh` is a sourceable shell library (no shebang `exec`; only function definitions). It defines exactly one public function:

```bash
push_current_branch() {
  local branch
  branch=$(git branch --show-current)
  git push -u origin "${branch}:${branch}"
}
```

- Called with no arguments.
- Idempotent: exits 0 even when nothing new to push.
- Sourced via a path relative to the calling script's `$SCRIPT_DIR`:
  `source "${SCRIPT_DIR}/../../_lib/push.sh"` (for scripts two levels below the repo root, e.g. `auto-fix-issue/scripts/`).

After the scripter's commits, the architect removes the standalone `git push` lines from the three markdown files listed below — these lines become redundant once each commit script pushes automatically.

## Markdown changes (architect)

After the scripter has committed and the scripts push on their own, the following markdown references to a standalone `git push` step must be removed or reworded:

- `auto-fix-issue/steps/open_pr.md` — the `## Push` section (`git push -u origin HEAD`) is now a no-op; remove the section.
- `auto-fix-all/steps/handle_comment.md` — the "After dispatching" bullet that reads `git push, then return to...` for both the comment and CI-failure branches is now redundant; remove only the `git push` instruction from those bullets (keep the "return to..." part).
- `auto-fix-all/steps/process_one_issue.md` — two redundant push steps:
  - In "### If `approved`", remove step 2 (`Push: git push`) and renumber.
  - In "### If CI `failed`", remove the `git push` instruction after "After all agents commit".

## Notes

- `reply_comment.sh` currently sources `${SCRIPT_DIR}/_lib_origin.sh` (a path that does not exist after the #67 refactoring). The scripter must also fix this reference to `../../_lib/origin.sh` while updating the file.
- The `monitor_pr.sh` defensive push runs at the top of the `while true` loop (just before the first `gh pr view` poll), so the branch is guaranteed up-to-date even if an upstream step forgot to push.
- `cleanup_artifacts.sh` only pushes when it actually committed (the existing `git diff --cached --quiet` guard already skips the commit when nothing changed; the push call goes right after the commit).
