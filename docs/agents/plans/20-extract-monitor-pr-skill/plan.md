# Plan: Extract Monitor pr skill

Issue: [20-extract-monitor-pr-skill.md](../issues/20-extract-monitor-pr-skill.md)

## Overview

Extract the PR-monitoring engine currently embedded in `auto-fix-all/scripts/monitor_pr.sh` into two new standalone skills — `auto-monitor-pr` (monitors a PR given its number) and `auto-monitor-issue-pr` (resolves the PR for an issue's checked-out branch, then delegates to `auto-monitor-pr`). `auto-fix-all` is updated to call `auto-monitor-issue-pr` instead of running its own monitoring script; all outcome-reaction logic (merge/close/approve/comment handling, queue advancement, CI wait, agent dispatch) stays in `auto-fix-all` unchanged, since the issue only asks to extract the blocking "wait and classify" step, not the pipeline orchestration around it.

## Context

`auto-fix-all/scripts/monitor_pr.sh` already supports two call shapes: an explicit `<pr_number> <pr_owner> <since_file>` form, and a convenience `monitor <issue_id>` form that resolves the PR number from the current branch (assumed to be `issue-<id>`) and derives a since-file path from the issue id. The blocking loop polls `gh pr view --json state,comments,reviews` plus the inline review-comments API, printing `merged`, `closed`, `approved`, or `commented` (+ comment bodies) on the first line. This logic needs to live in its own skills so it can be reused outside `auto-fix-all`.

## Implementation Steps

### Step 1 — Create `auto-monitor-pr`

New skill folder, the lower-level primitive that monitors a known PR number.

- `auto-monitor-pr/scripts/_lib_origin.sh` — copy verbatim from `auto-fix-all/scripts/_lib_origin.sh` (same project convention: each skill folder keeps its own copy of this helper instead of sharing it cross-skill).
- `auto-monitor-pr/scripts/monitor_pr.sh <pr_number>` — single positional argument. Internally: `_ensure_gh_user`, resolve `PR_OWNER` via `get_gh_user`, derive `SINCE_FILE=.claude/state/auto-monitor-pr-<pr_number>-since.txt`, then run the exact same blocking loop body currently in `auto-fix-all/scripts/monitor_pr.sh` (state check, latest-review approval check, inline+conversation comment collection, `:shipit:` detection, since-file bookkeeping). Output contract unchanged: first line `merged`/`closed`/`approved`/`commented`, followed by `---`-separated comment bodies when `commented`.
- `auto-monitor-pr/SKILL.md` — frontmatter `name: auto-monitor-pr`, description covering "Monitors a given PR for merge/close/approval/new owner comments, blocking until one occurs. Usage: /auto-monitor-pr <pr_number>". Body: parse `<pr_number>` (strip leading `#` if present), run `scripts/monitor_pr.sh <pr_number>`, and report its output verbatim. This skill's job ends at reporting the outcome — reacting to it is the caller's responsibility.

### Step 2 — Create `auto-monitor-issue-pr`

New skill folder, the issue-aware wrapper used by `auto-fix-all`.

- `auto-monitor-issue-pr/scripts/_lib_origin.sh` — copy verbatim, same as Step 1 (self-contained skill convention).
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh <id>` — resolves the PR number for the **current branch** (assumed already checked out as `issue-<id>` by the caller), same lookup as `auto-fix-all/scripts/github.sh`'s `pr-number` command (`gh pr view -R <repo_ref> <branch> --json number -q .number`); errors clearly to stderr and exits non-zero if no PR is found. `<id>` is accepted for usage clarity/validation (must be numeric) even though the branch, not the id, drives the lookup.
- `auto-monitor-issue-pr/SKILL.md` — frontmatter `name: auto-monitor-issue-pr`, description covering "Resolves the PR for the current issue branch and monitors it for merge/close/approval/comments, blocking until one occurs. Usage: /auto-monitor-issue-pr <id>". Body: parse `<id>` (strip leading `#`), run `scripts/resolve_pr_number.sh <id>` to get `PR_NUMBER`, then read [../auto-monitor-pr/SKILL.md](../auto-monitor-pr/SKILL.md) and follow it for `PR_NUMBER`, reporting whatever it reports.

### Step 3 — Update `auto-fix-all` to use the new skills

- `auto-fix-all/steps/monitor_pr.md` — replace the "Block on the monitor script" section (currently running `scripts/monitor_pr.sh monitor <id>` directly) with an instruction to read [../../auto-monitor-issue-pr/SKILL.md](../../auto-monitor-issue-pr/SKILL.md) and follow it for `<id>`, using its reported output as the same `merged`/`closed`/`approved`/`commented` outcome the rest of the file already branches on. Leave every `### If ...` reaction section below untouched — they are pipeline-specific (queue, cleanup, CI wait, agent dispatch) and out of scope for this extraction.
- `auto-fix-all/scripts/monitor_pr.sh` — delete; no longer used now that `auto-fix-all` delegates to `auto-monitor-issue-pr`.

## Files to Change

- `auto-monitor-pr/SKILL.md` — new
- `auto-monitor-pr/scripts/monitor_pr.sh` — new
- `auto-monitor-pr/scripts/_lib_origin.sh` — new
- `auto-monitor-issue-pr/SKILL.md` — new
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — new
- `auto-monitor-issue-pr/scripts/_lib_origin.sh` — new
- `auto-fix-all/steps/monitor_pr.md` — update the monitoring step to delegate to `auto-monitor-issue-pr`
- `auto-fix-all/scripts/monitor_pr.sh` — delete

## Notes

- Since-file naming changes from `.claude/state/auto-fix-all-<id>-since.txt` to `.claude/state/auto-monitor-pr-<pr_number>-since.txt`. This is acceptable: since-files are ephemeral polling bookkeeping (last-seen comment timestamp), not durable state, and keying by PR number is arguably more correct than keying by issue id.
- This repo is markdown-only with no CI config, so no `## CI Checks` section applies.
