# Plan: Monitor issues should react to issues updates

Issue: [60-monitor-issues-should-react-to-issues-updates.md](../../issues/60-monitor-issues-should-react-to-issues-updates.md)

## Overview
`monitor-issues` currently fetches both open and closed issues, only logs the `:pencil2:` actionable tag without acting on it, and writes the per-issue `updated_at` before any dispatched action runs (so a failed action is never retried). This plan splits the work: `scripter` adjusts `monitor_issues.sh` (open-issues-only filtering, deferred `updated_at` write, and the dispatch hook for `pencil2`), while `architect` adds the new non-interactive rewrite step/skill that performs the actual issue-body rewrite and documents the change.

## Agents involved

- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

- **New script:** `monitor-issues/scripts/rewrite_issue.sh <id>` (or equivalent name decided by `scripter`/`architect` together — see below) — a deterministic wrapper script, created by `scripter`, that `monitor_issues.sh`'s dispatch loop calls for the `pencil2` action. It is a thin orchestration wrapper, not the AI judgment itself: judgment (drafting the new issue body) cannot live in a bash script, so the actual rewrite step is delegated to a markdown-driven `architect`-level flow (new `auto-rewrite-issue` skill, `steps/run.md`) that `scripter`'s wrapper script cannot invoke directly.
- **Resolution:** Since rewriting an issue body requires AI judgment (drafting prose), it cannot be done inside `monitor_issues.sh` itself (a non-interactive bash loop with no LLM access at script-execution time). Therefore:
  - `scripter` changes `monitor_issues.sh`'s `pencil2` case to push the issue id onto a **new dedicated queue** (mirroring `auto-fix-all`'s existing queue pattern) via a new script `monitor-issues/scripts/rewrite_queue.sh push <id>`, instead of just logging.
  - `architect` creates a new `auto-rewrite-issue` skill (`SKILL.md` + `steps/run.md`) that a human (or a future coordinator loop) invokes to drain that queue and perform the rewrite + `remove-tag` + GitHub update, following the same `SKILL.md`-thin/`steps/run.md`-thick split documented in `docs/agents/architecture.md`'s "Architect Delegation" section.
  - **Contract between the two:** the queue file is `.claude/state/monitor-issues-rewrite-queue.json`, schema `[{"id": "<issue_id>"}, ...]`, manipulated only via `monitor-issues/scripts/rewrite_queue.sh push|pop` (locking pattern copied from `auto-fix-all/scripts/queue.sh`). `scripter` owns `push`; `architect`'s new skill owns `pop` + the rewrite logic.
- **`updated_at` deferral contract:** `scripter` restructures `_poll_once` so that for issues carrying an actionable tag requiring a dispatched action (`pencil2`, and `clipboard` since it already has a deterministic action), the call to `_write_issues` (writing `updated_at`) only happens after the dispatched action (queue push, in both cases) reports success (exit 0). For issues with no actionable tag, `updated_at` is written immediately as before. `architect` does not need to touch this — it is entirely inside `monitor_issues.sh`, but is recorded here since it changes the shape of `_poll_once` that `scripter` must respect issue-by-issue (the `updated_at` write must move to *after* the per-issue dispatch loop, not stay before it).

## Notes
- The `question` actionable tag remains pure logging — only `pencil2` gains a wired action per this issue. `clipboard` already pushes to `auto-fix-all`'s queue; that path is unaffected except for the `updated_at` deferral.
- No CI config exists in this repo (no `.github/workflows/*`, no `.circleci/config.yml`) — there is no `## CI Checks` section in either sub-plan; manual local script runs are the only verification.
