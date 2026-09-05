Run a single bounded check on the given PR and report the result verbatim — no blocking, no confirmation loop, and no decision about what `pending` or a comment means. Whichever layer reads this file (the `auto-monitor-pr` coordinator itself, or a nested caller like `auto-monitor-issue-pr`) is responsible for deciding what to do with the result, e.g. whether/how to reschedule on `pending`.

`REPO_PATH` (the target project's root) is carried in from your invocation prompt or from whichever nested caller read this file directly — thread it through to the script call below.

## Step 1 — Run one check

```bash
scripts/monitor_pr.sh "$REPO_PATH" --pr-number <pr_number> [--issue-id <id>]
```

> Resolve `scripts/monitor_pr.sh` relative to the `auto-monitor-pr` skill folder.

`--pr-number <pr_number>` is the raw skill argument — the script accepts it with or without a leading `#`. `--issue-id <id>` is the optional issue id — when supplied, the script reads/writes `.claude/state/issue-<id>.json` for `comments`/`last_comment_time` instead of the legacy per-PR file (`.claude/state/auto-monitor-pr-<pr_number>-comments.json`). When `--issue-id` is absent or its value is empty, the script falls back to the legacy per-PR file (backward-compatible).

This resolves the PR owner (`git config user.ghuser`) internally, then performs exactly one check pass and returns immediately — it no longer loops or sleeps internally. The comments-file tracks the last-seen comment timestamp (`last_comment_time`) across separate invocations, plus each owner comment's lifecycle (`open` -> `addressed`), and drives reactions on the comment itself — `:eyes:` while open, swapped for `:+1:` once addressed (GitHub's reaction set has no check-mark; `:+1:` is the closest available). The first output line is `pending` (nothing terminal found this pass — the caller is expected to re-invoke this file later to check again), `merged`, `closed`, `approved`, or `commented`; when `commented`, the lines after the first are the new comments, one per `---`-separated block, each block starting with an `id: <node id>` line and a `url: <html url>` line, followed by the comment body.

## Step 2 — Report

Report the script's output verbatim to the caller (the outcome word — including `pending` — plus the `id`/`url`/body of each comment when `commented`). Do not decide what to do about a comment, and do not decide what to do about `pending` (e.g. whether or how to reschedule) — that is the caller's responsibility.
