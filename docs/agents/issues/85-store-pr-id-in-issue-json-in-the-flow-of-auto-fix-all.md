# Issue: Store PR id in issue JSON in the flow of auto-fix-all

## Description
When `auto-fix-all` orchestrates a fix and `auto-fix-issue` opens a pull request, the PR number and URL are not persisted anywhere in the issue state JSON (`.claude/state/issue-<id>.json`). Any downstream step that needs to reference the PR must re-query GitHub to find it.

## Problem
After `auto-fix-issue` sets `step=pr_published`, the PR number and URL are only available in the transient output of `gh pr create` or via a `gh pr list` call at runtime. There is no persistent local record tying an issue to its open PR, which means skills like `auto-monitor-issue-pr` or future recovery flows must perform an extra GitHub API call to locate the PR.

## Expected Behavior
After `auto-fix-issue` opens or marks-ready a PR, two fields are written to `.claude/state/issue-<id>.json` via `issue_state.sh`:
- `pr_id` — the integer PR number (e.g. `42`)
- `pr_url` — the full HTML URL (e.g. `https://github.com/owner/repo/pull/42`)

Both fields are set inside the `auto-fix-issue` skill, as close as possible to the point where the PR is created or marked ready.

Skills that currently look up the PR via GitHub API (e.g. `auto-monitor-issue-pr`, `auto-fix-all`) are updated to read `pr_id` and `pr_url` from the issue JSON using `issue_state.sh get` instead.

## Solution
**Part 1 — Write the fields in auto-fix-issue:**
In the `auto-fix-issue` skill's `open_pr.md` step (or in the `github.sh pr-create` / `pr-ready` script commands), after the PR URL is obtained from `gh pr create`, extract the PR number from the URL and call:

```bash
issue_state.sh set <id> pr_url <url>
issue_state.sh set <id> pr_id  <number>
```

The `scripts/github.sh pr-create` command already captures the URL; the number is the last path segment of that URL.

**Part 2 — Read the fields in downstream skills:**
Skills that currently resolve the PR by querying GitHub (e.g. `auto-monitor-issue-pr`, `auto-fix-all`) are updated to instead call:

```bash
issue_state.sh get <id> pr_id
issue_state.sh get <id> pr_url
```

This eliminates the extra API calls and makes those skills resilient to cases where `gh pr list` would return ambiguous results.

## Benefits
- Skills downstream of `auto-fix-issue` can read the PR number and URL directly from the local state JSON without extra GitHub API calls.
- Provides a local audit trail linking each issue to its open PR.
- Decouples PR resolution from GitHub availability in monitoring and recovery flows.
