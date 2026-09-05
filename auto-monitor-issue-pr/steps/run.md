Resolve the PR for the issue's branch and run a single bounded check on it — no blocking, no confirmation loop, and no decision about what `pending` or a comment means. Whichever layer reads this file (the `auto-monitor-issue-pr` coordinator itself, or a nested caller like `auto-fix-all`'s `process_one_issue.md`) is responsible for deciding what to do with the result, e.g. whether/how to reschedule on `pending`.

`REPO_PATH` (the target project's root) is carried in from your invocation prompt or from whichever nested caller read this file directly — thread it through to every script call below and into the nested read in Step 2.

## Step 1 — Resolve the PR number

```bash
scripts/resolve_pr_number.sh "$REPO_PATH" <id>
```

> Resolve `scripts/resolve_pr_number.sh` relative to the `auto-monitor-issue-pr` skill folder.

`<id>` is the raw skill argument — the script accepts it with or without a leading `#`. This assumes the issue's branch (`issue-<id>`) is already checked out — the same assumption `auto-fix-all` already makes when it reaches this point. It resolves the PR number for the current branch on the configured origin repo. Call the result `<pr_number>`.

## Step 2 — Run one check

Read [../../auto-monitor-pr/steps/run.md](../../auto-monitor-pr/steps/run.md) and follow it for `<pr_number>` and `<id>` (the issue id from the skill argument), carrying `REPO_PATH` forward unchanged (do not re-resolve it). Pass `--pr-number <pr_number>` and `--issue-id <id>` so the monitor script stores comments state in `.claude/state/issue-<id>.json` rather than the legacy per-PR file. It performs exactly one bounded check and reports either `pending` (nothing terminal found this pass) or a terminal outcome (`merged`, `closed`, `approved`, or `commented` + one `id`/`url`/body block per new comment) — no blocking, no internal loop.

> You are already running inside an architect agent (or the `auto-monitor-issue-pr` coordinator itself) — follow `run.md` directly here; do not spawn another `Agent(architect)` for it.

## Step 3 — Report

Report whatever the check reported, verbatim — including `pending`. Do not decide what to do about a comment, and do not decide what to do about `pending` (e.g. whether or how to reschedule) — that is the caller's responsibility.

> **Permission-rule gotcha:** `scripts/resolve_pr_number.sh` (this skill) and `auto-monitor-pr/scripts/monitor_pr.sh` both take a PR/issue number as an argument, and now also a leading `<repo_path>` argument that varies per checkout. If a local `.claude/settings.local.json` ever grants these scripts permission with the number (or a specific repo path) baked in (e.g. `Bash(auto-monitor-issue-pr/scripts/resolve_pr_number.sh 21 *)`), the rule will never match a future issue's number or a different checkout path, and Claude Code will prompt for permission again on every new issue — silently breaking the "no confirmation loop" contract this skill promises. This applies whether these scripts run inside a spawned architect agent (nested read, e.g. from `auto-fix-all`) or directly at the `auto-monitor-issue-pr` coordinator layer (Step 2 above), since both paths reach the same two script calls. Always keep (or rewrite) these two rules as fully wildcarded, e.g. `Bash(auto-monitor-issue-pr/scripts/resolve_pr_number.sh *)` and `Bash(auto-monitor-pr/scripts/monitor_pr.sh *)` (no longer anchored on `--pr-number` as the first literal token, since `<repo_path>` now precedes it), covering every path form (relative and absolute) under which they get invoked.
