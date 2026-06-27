# Plan: Store PR id in issue JSON in the flow of auto-fix-all

Issue: [85-store-pr-id-in-issue-json-in-the-flow-of-auto-fix-all.md](../issues/85-store-pr-id-in-issue-json-in-the-flow-of-auto-fix-all.md)

## Overview

After `auto-fix-issue` opens or marks-ready a PR, persist `pr_id` (integer) and `pr_url` (full HTML URL) into `.claude/state/issue-<id>.json` via `issue_state.sh`. Downstream scripts that currently query GitHub to resolve the PR number are then updated to read from the local state first, falling back to the GitHub API only if the field is absent.

## Context

`auto-fix-issue/steps/open_pr.md` creates or marks-ready a PR and obtains the URL but does not persist it. `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` and `auto-fix-all/scripts/github.sh` (commands `pr-number` and `pr-merge`) all query `gh pr view` at runtime to find the PR — an extra API call that can be eliminated once the number is stored locally.

## Implementation Steps

### Step 1 — Persist pr_url and pr_id in open_pr.md

In `auto-fix-issue/steps/open_pr.md`, after each code path that yields a PR URL (both the "PR already exists" path that reads `URL=` from `pr-view`, and the "Create the PR" path that reads the URL from `pr-create`), add instructions to:

1. Extract the PR number from the URL: the number is the last path segment of the URL (after the final `/`).
2. Call `scripts/issue_state.sh set <id> pr_url <url>` and `scripts/issue_state.sh set <id> pr_id <number>`.

These calls must happen before the `## Report` section so that downstream steps can rely on the state being populated immediately after `open_pr.md` runs.

### Step 2 — Update resolve_pr_number.sh to use issue state first

In `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`, before the `gh pr view` call:

1. Source `_lib/issue_state.sh` (or call it directly via the `_lib` path, consistent with how other scripts in this skill call `_lib/`).
2. Attempt `issue_state.sh get <id> pr_id`; if the result is non-empty, print it and exit 0.
3. Only proceed to `gh pr view` if the state field is absent or empty.

### Step 3 — Update auto-fix-all/scripts/github.sh to use issue state first

In `auto-fix-all/scripts/github.sh`:

- `cmd_pr_number`: Before calling `gh pr view`, extract the issue ID from the current branch name (`branch=$(git branch --show-current)` → strip the `issue-` prefix), then call `issue_state.sh get <id> pr_id` via `_lib/issue_state.sh`. If non-empty, print the number and return. Only fall back to `gh pr view` if absent.

- `cmd_pr_merge`: Before calling `gh pr view` to fetch `title,number,url`, attempt to read `pr_id` and `pr_url` from the issue state in the same way. If both are present, use them directly and skip the first `gh pr view` call (the `gh pr merge` call itself is still required).

## Files to Change

- `auto-fix-issue/steps/open_pr.md` — add `issue_state.sh set` calls after every code path that yields a PR URL
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — read `pr_id` from issue state before querying GitHub
- `auto-fix-all/scripts/github.sh` — update `cmd_pr_number` and `cmd_pr_merge` to read from issue state first

## Notes

- The `issue_state.sh` in all three locations is a thin wrapper that delegates to `_lib/issue_state.sh`; scripts can call it via the `_lib` path or the local wrapper — be consistent with the existing style in each file.
- `auto-fix-all/scripts/github.sh` does not currently source `_lib/issue_state.sh`; it must be added to the sourcing block at the top of that file.
- The branch-name-to-issue-id extraction in `github.sh` (`issue-<id>` → `<id>`) is straightforward string stripping; add a guard that skips the state lookup if the branch name does not match the `issue-<id>` pattern.
- `pr-merge` still needs `title` and `number` for the merge commit subject line; if `pr_id` is in state but `title` is not, a `gh pr view` call is still needed (for title only). Keep the logic simple: if `pr_id` and `pr_url` are both in state, still fetch `title` via `gh pr view --json title` only.
