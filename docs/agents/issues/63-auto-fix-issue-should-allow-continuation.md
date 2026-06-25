# auto-fix-issue should allow continuation

## Context

`auto-fix-issue` runs its 6-step flow (locate plan, create branch, list specialist agents, dispatch agents, review, publish PR) as a single architect-agent session with no persisted progress. If that session is interrupted — context cleared, crashed, or stopped — re-invoking `/auto-fix-issue <id>` starts over from step 1 instead of picking up where it left off.

Additionally, per-issue and per-PR JSON state files have grown organically across multiple skills with inconsistent conventions, creating fragmentation:
- `monitor-issues` uses a single `.claude/state/issues.json` keyed by issue id, storing `{updated_at, tags}`.
- `auto-monitor-pr` uses one file per PR number, `.claude/state/auto-monitor-pr-<pr_number>-comments.json`, storing `{comments, last_comment_time}`.
- `auto-fix-issue` stores nothing today.

## What needs to be done

- Add a single state file per issue at `.claude/state/issue-<id>.json`, consolidating what each skill needs to know about an issue (monitor-issues' tags/updated_at, auto-monitor-pr's comment lifecycle keyed by issue id rather than PR number, and auto-fix-issue's current step).
- Wrap each existing step-boundary script in `auto-fix-issue` (`resolve_plan_paths.sh`, `create_branch.sh`, `list_plan_agents.sh`, `commit_change.sh`, `github.sh pr-create`/`pr-ready`) so that after the original script succeeds it also records the completed step in `.claude/state/issue-<id>.json`. Original scripts and their existing call sites stay unchanged.
- Add a step-resolution check at the top of `auto-fix-issue/steps/run.md`: read `issue-<id>.json`'s recorded step (if any) and jump directly to it instead of always starting at Step 1.
- Migrate `monitor-issues` (`.claude/state/issues.json` → per-id entries in `issue-<id>.json`) and `auto-monitor-pr` (`.claude/state/auto-monitor-pr-<pr_number>-comments.json` → `issue-<id>.json`, threading the issue id through to `monitor_pr.sh`) onto the same file convention.
- Reuse/generalize the existing lock-file pattern (already used by `monitor-issues` and `auto-fix-all`'s `queue.sh`/`config.sh`) for safe concurrent read/modify/write of the shared `issue-<id>.json`.

## Acceptance criteria

- [ ] A single `.claude/state/issue-<id>.json` file is the canonical store for all per-issue/per-PR state (monitor-issues tags, auto-monitor-pr comment lifecycle, auto-fix-issue step progress).
- [ ] When `auto-fix-issue` is invoked for an id whose file already shows a recorded step, it resumes directly at that step without re-verifying external state.
- [ ] When invoked for a fresh id (no file or no step recorded), it starts at Step 1 as today.
- [ ] `monitor-issues` and `auto-monitor-pr` are migrated to the new per-id file convention.
- [ ] Concurrent access to `issue-<id>.json` is safe via the lock-file pattern.
