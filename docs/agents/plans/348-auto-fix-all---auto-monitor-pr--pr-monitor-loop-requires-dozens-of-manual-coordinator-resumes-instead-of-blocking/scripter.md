# Scripter Plan: auto-fix-all / auto-monitor-pr: PR-monitor loop requires dozens of manual coordinator resumes instead of blocking

Main plan: [plan.md](plan.md)

## Shared contracts

Your script must keep producing the existing `merged`/`closed`/`approved`/`commented` outputs unchanged, and add exactly one new output: a bare `pending` line (exit 0) whenever a pass finds no terminal state and no new owner comment. Skill-writer's updated call sites (auto-monitor-pr, auto-monitor-issue-pr, auto-fix-all) all key off this exact contract to decide whether to reschedule (`pending`) or handle a real outcome.

## Implementation Steps

### Step 1 — Make monitor_pr.sh do a single bounded check instead of looping forever

Remove the `while true; do ... sleep 5; continue; done` structure. The script should perform exactly one pass:

- Do the "resolve any comments left processing" reconciliation at the top exactly as today (unchanged).
- Run one iteration of the current loop body: fetch PR state/comments/reviews, check merged/closed/approved, fetch new owner comments, handle `:shipit:` → `approved`, and the fetched/processing/persisted comment-state bookkeeping — all unchanged.
- Every `sleep 5; continue` (transient `gh` error, or "nothing new found yet") becomes: print `pending` and `exit 0` instead of sleeping and retrying internally.
- Every existing terminal `echo ...; exit 0` (`merged`, `closed`, `approved`, `commented` + comment blocks) stays exactly as today.

The script keeps its exact current usage/flags (`<repo_path> --pr-number <pr_number> [--issue-id <id>]`) — only the "nothing happened this pass" behavior changes, from an internal retry to a `pending` result the caller re-invokes later.

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr.sh` — replace the internal `while true`/`sleep 5` loop with a single pass that returns `pending` instead of retrying internally; keep every other behavior (comment-state persistence, reactions, output formats for the four existing outcomes) unchanged.

## Notes

- Since a transient `gh` error now surfaces as `pending` (rather than being silently retried inside the script), callers re-invoking on `pending` inherently also retries transient errors — no separate error-handling path is needed.
- Update the header comment block (lines 1–50) to describe the new single-pass/`pending` contract instead of the old "blocking loop" description, since it's the primary documentation of this script's behavior today.
