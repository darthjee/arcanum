# Plan: auto-fix-all / auto-monitor-pr: PR-monitor loop requires dozens of manual coordinator resumes instead of blocking

Issue: [348-auto-fix-all---auto-monitor-pr--pr-monitor-loop-requires-dozens-of-manual-coordinator-resumes-instead-of-blocking.md](../issues/348-auto-fix-all---auto-monitor-pr--pr-monitor-loop-requires-dozens-of-manual-coordinator-resumes-instead-of-blocking.md)

## Overview

Replace `monitor_pr.sh`'s internal `sleep 5; loop forever` with a single bounded check per invocation that reports a terminal outcome or `pending`. Move ownership of "wait, then re-check later" to whichever layer actually has `ScheduleWakeup` — the `auto-monitor-pr`/`auto-monitor-issue-pr` coordinators for their standalone skills, and the top-level `auto-fix-all` coordinator (via a new `OUTCOME=pending PR_NUMBER=<n>` outcome from the per-issue `architect` subagent) for the `auto-fix-all` pipeline. This removes the long-lived background poll process entirely, along with the resume-loop cost and the process-lifecycle bugs (killed externally, duplicated) it caused.

## Agents involved

- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

`auto-monitor-pr/scripts/monitor_pr.sh`'s output contract, produced by scripter and consumed by every skill-writer call site:

- Unchanged terminal outcomes, still a single line optionally followed by data, exit 0:
  - `merged`
  - `closed`
  - `approved`
  - `commented` followed by one `---`-prefixed block per new comment (`id: <node id>`, `url: <html url>`, body) — exactly as today.
- New: `pending` — a single line, exit 0, printed whenever the current pass found no terminal state and no new owner comment. Replaces the old behavior of sleeping 5s and looping internally. The script performs exactly one check pass per invocation now; it never loops or sleeps internally.
- All other behavior (comments-state persistence in `.claude/state/issue-<id>.json` or the legacy per-PR file, `:eyes:`/`:+1:` reaction lifecycle, `--pr-number`/`--issue-id` flags) is unchanged.

Callers are responsible for re-invoking the script after a delay on `pending` — the script itself no longer waits.
