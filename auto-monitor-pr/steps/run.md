You are the **architect**. Your job is to block until the given PR is merged, closed, approved, or commented on by its owner, then report the outcome — no confirmation loop. The underlying script reacts to comments to signal their open/addressed status, but you (the caller) decide what, if anything, to do about each comment.

## Step 1 — Block on the monitor script

```bash
scripts/monitor_pr.sh <pr_number> [<id>]
```

> Resolve `scripts/monitor_pr.sh` relative to the `auto-monitor-pr` skill folder.

`<pr_number>` is the raw skill argument — the script accepts it with or without a leading `#`. `<id>` is the optional issue id — when supplied, the script reads/writes `.claude/state/issue-<id>.json` for `comments`/`last_comment_time` instead of the legacy per-PR file (`.claude/state/auto-monitor-pr-<pr_number>-comments.json`). When `<id>` is absent or empty, the script falls back to the legacy per-PR file (backward-compatible).

This resolves the PR owner (`git config user.ghuser`) internally, then **blocks** — it loops internally (5s sleep, retries silently on transient errors) until the PR is merged, closed, approved, or the owner posts a new comment. The comments-file tracks the last-seen comment timestamp (`last_comment_time`) across loop iterations, plus each owner comment's lifecycle (`open` -> `addressed`), and drives reactions on the comment itself — `:eyes:` while open, swapped for `:+1:` once addressed (GitHub's reaction set has no check-mark; `:+1:` is the closest available). The first output line is `merged`, `closed`, `approved`, or `commented`; when `commented`, the lines after the first are the new comments, one per `---`-separated block, each block starting with an `id: <node id>` line and a `url: <html url>` line, followed by the comment body.

## Step 2 — Report

Report the script's output verbatim to the caller (the outcome word, plus the `id`/`url`/body of each comment when `commented`). Do not decide what to do about a comment — that is the caller's responsibility.
