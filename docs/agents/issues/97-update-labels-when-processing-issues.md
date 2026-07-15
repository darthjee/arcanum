# Issue: Update labels when processing issues

## Description
Automate GitHub label transitions at key pipeline checkpoints instead of leaving live issue labels to drift out of sync with the pipeline stage the issue is actually in.

## Problem
Several scripts already *read* issue labels to decide what to do (`discuss-issue`'s `github.sh update`, `auto-fix-all`'s queue seeding, `monitor-issues`' and `push-issue-to-queue`'s queue push), but none of them *write* labels back to reflect the new state. An issue can sit refined-and-ready or already enqueued while GitHub still shows it tagged `Created`, so the label-based issue list (see `docs/agents/architecture.md`'s "Issue Tags") no longer reflects reality at a glance.

## Expected Behavior
- When `discuss-issue` pushes the finalized title/body to GitHub (its "Push to GitHub" step), the issue gains the `Ready` label and loses `Created` (if present).
- When an issue id is added to the `auto-fix-all` queue — via `auto-fix-all`'s initial seed, `monitor-issues` detecting `Ready for Work`, or `push-issue-to-queue` — the issue gains `Enqueued` and loses `Ready for Work` and `Created` (if present).
- All of this happens inside existing scripts, deterministically — no new agent-level reasoning steps are added.
- A failed label mutation (e.g. a transient GitHub API error) never blocks the primary action (the queue push, or the issue sync) — it logs a warning to stderr and continues, the same way `monitor_issues.sh` already treats similar non-critical failures.

## Solution
- Add two canonical tags to `_lib/tags.sh`: `ready` → `Ready`, `enqueued` → `Enqueued`, so `_lib/tag_mutate.sh`'s existing `tag_mutate_add_label`/`tag_mutate_remove_label` primitives can drive them.
- Centralize the enqueue-time label swap inside `auto-fix-all/scripts/queue.sh`'s `save` and `push` cases (the only two places that ever add ids to the queue). This single change covers `auto-fix-all`, `monitor-issues`, and `push-issue-to-queue` at once, since all three already funnel through this script — no changes needed in those three skills themselves.
- Add the discuss-time label swap as a new `mark-ready` subcommand in `_lib/github_issue.sh`, called by `discuss-issue`'s "Push to GitHub" step right after `update` succeeds. `cmd_update` itself stays untouched, so `auto-new-issue` (which also calls `update`, to sync freshly authored issues) is unaffected and its issues are not marked `Ready`.

## Benefits
Live GitHub labels stay in sync with the actual pipeline stage automatically, with no added token/agent cost, keeping the issue list trustworthy at a glance.
