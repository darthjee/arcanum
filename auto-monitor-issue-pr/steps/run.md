You are the **architect**. Your job is to resolve the PR for the issue's branch and delegate monitoring to `auto-monitor-pr` — no reaction, no confirmation loop.

## Step 1 — Resolve the PR number

```bash
scripts/resolve_pr_number.sh <id>
```

> Resolve `scripts/resolve_pr_number.sh` relative to the `auto-monitor-issue-pr` skill folder.

`<id>` is the raw skill argument — the script accepts it with or without a leading `#`. This assumes the issue's branch (`issue-<id>`) is already checked out — the same assumption `auto-fix-all` already makes when it reaches this point. It resolves the PR number for the current branch on the configured origin repo. Call the result `<pr_number>`.

## Step 2 — Delegate monitoring

Read [../../auto-monitor-pr/steps/run.md](../../auto-monitor-pr/steps/run.md) and follow it for `<pr_number>`. It blocks and reports the outcome (`merged`, `closed`, `approved`, or `commented` + one `id`/`url`/body block per new comment).

> You are already running inside an architect agent — follow `run.md` directly here; do not spawn another `Agent(architect)` for it.

## Step 3 — Report

Report whatever the monitor step reported, verbatim. Do not decide what to do about a comment — that is the caller's responsibility.
