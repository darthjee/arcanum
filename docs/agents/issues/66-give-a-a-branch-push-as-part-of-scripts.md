# Issue: Give a branch push as part of scripts

## Description
Several auto-fix-all/auto-fix-issue scripts that already run `git commit` (`commit_change.sh`, `commit_issue.sh`, `commit_plan.sh`, `cleanup_artifacts.sh`) do not push afterwards. The push currently happens as a separate `git push` line written in markdown steps (e.g. `auto-fix-issue/steps/open_pr.md`, `auto-fix-all/steps/handle_comment.md`, `auto-fix-all/steps/process_one_issue.md`), which the agent must remember to run every time.

## Problem
Relying on natural-language `git push` instructions scattered across multiple markdown files is non-deterministic — the agent could skip or mistime the push, leaving the remote branch out of date relative to local commits (e.g. while `auto-monitor-issue-pr`/`auto-monitor-pr` poll for CI status or new owner comments on the PR).

## Expected Behavior
Every script that commits should also push immediately afterward, so the remote branch is always in sync with the local one without depending on a separate documented step.

## Solution
- Add a shared helper, e.g. `_lib/push.sh`, exposing a `push_current_branch` function that resolves the current branch name (`git branch --show-current`) and runs `git push -u origin <branch>:<branch>` explicitly by name (instead of the implicit `git push -u origin HEAD`), so the push always targets the issue's actual branch — whether it's the default `issue-<id>` or a custom name from the plan's `## Branch` section.
- Source this helper and call it as the last step of `commit_change.sh`, `commit_issue.sh`, `commit_plan.sh`, and `cleanup_artifacts.sh` (auto-fix-issue/auto-fix-all scripts), right after the `git commit` call.
- Also call it from `reply_comment.sh` defensively, even though it only posts a `gh pr comment` and never touches git history, for consistency with the rest of the action scripts in this family.
- Call it defensively at the start of `auto-monitor-pr/scripts/monitor_pr.sh`'s loop too, resolving the branch the same way (`git branch --show-current`) regardless of whether `--issue-id` was given, so the branch is guaranteed up to date even if some upstream step forgot to push.
- Remove the now-redundant standalone `git push` steps from `auto-fix-issue/steps/open_pr.md`, `auto-fix-all/steps/handle_comment.md`, and `auto-fix-all/steps/process_one_issue.md`, since the scripts they call already push.

## Benefits
- The branch is always pushed right after every commit, removing a class of bugs where the agent forgets or mistimes a manual `git push` step.
- Centralizes push behavior in scripts instead of natural-language instructions, in line with this project's convention of extracting deterministic logic out of skill markdown.
