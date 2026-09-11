# Issue: Migrate auto-monitor-pr-monitor-pr entrypoint to native Node.js

## Description

Sub-issue of #427 (batch overview). Part of the `auto-monitor-pr` family — migrating `auto-monitor-pr/scripts/monitor_pr.sh` (255 lines, the most complex script in this batch) to a native Node.js implementation, per the [Script Engine migration](docs/agents/architecture/script-engine.md).

### Source script

`auto-monitor-pr/scripts/monitor_pr.sh` — a single-pass check for merge/close/approval/new-owner-comments on a PR. Usage: `monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]`.

- Resolves `PR_OWNER` via `get_gh_user`; derives comment-tracking state either as `.claude/state/auto-monitor-pr-<pr_number>-comments.json` (legacy, `--issue-id` absent — a JSON object with a `comments` key) or as the `pr_comments`/`last_comment_time` fields inside `.claude/state/issue-<id>.json` (when `--issue-id` is given).
- On every invocation, first resolves any comment still marked `"processing"` from a prior run (assumed addressed by whatever triggered this fresh run — the only caller that restarts it is `auto-fix-all`, after pushing a fix): swaps its `:eyes:` reaction for `:+1:`, sets state to `"addressed"`.
- Polls `gh pr view --json state,comments,reviews` plus the inline review-comments REST endpoint (`repos/<repo>/pulls/<pr>/comments`), normalizing all three comment sources (conversation, inline, review bodies) to `{login, createdAt, body, id, url}`.
- Behavior: `MERGED` → print `merged` (and delete the state file), exit 0. `CLOSED` → print `closed`, exit 0. Latest review by `PR_OWNER` is `APPROVED` → print `approved`, exit 0. Else, collect the owner's comments newer than `last_comment_time`; if any is exactly `:shipit:` → print `approved`, exit 0; otherwise persist them as `"fetched"` (crash-recovery checkpoint), add `:eyes:` reactions and mark `"processing"`, then print `commented` followed by each new comment as a `---`-preceded `id:`/`url:`/body block, exit 0. If nothing new (or a transient `gh` error at any point) → print `pending`, exit 0 — the caller re-invokes later.

## Solution

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-monitor-pr/scripts/monitor_pr.sh` in full for its exact output/exit-code contract — pay particular attention to the three-state comment lifecycle (`fetched` → `processing` → `addressed`) and the two divergent state-file shapes (per-PR file vs. per-issue file).
2. Create `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-monitor-pr-monitor-pr': { module: 'commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js', method: 'run' }`.
4. Add `"auto-monitor-pr-monitor-pr": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/commands/auto-monitor-pr/AutoMonitorPrMonitorPr_spec.js`, covering: merged/closed/approved/shipit-comment/regular-comment/pending outcomes, both state-file shapes, and the processing→addressed resolution on a fresh invocation.
6. Write a parity test (shell vs. native, identical stdout/exit code) — likely needs a mocked/stubbed `gh` given the number of API calls involved (see precedent for `auto-fix-all-wait-ci`'s parity approach, the closest existing polling-script migration).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

### External dependencies

- `gh pr view --json state,comments,reviews`, `gh api repos/<repo>/pulls/<pr>/comments`, `gh api graphql` (add/remove reaction mutations) — all GitHub API surface, no local git mutation besides `push_current_branch` (best-effort, errors swallowed).
- Sources `arcanum/_lib/origin.sh` (`get_gh_user`, `get_repo_ref`, `_ensure_gh_user`) and `arcanum/_lib/push.sh` (`push_current_branch`) — both still shell; re-derive natively.
- Calls the sibling `auto-fix-issue/scripts/issue_state.sh` (already migrated as `issue-state`) via `set-json`/`set` when `--issue-id` is given.
- This is the entrypoint driven externally via `ScheduleWakeup` by the `/auto-monitor-pr` skill (one bounded check per invocation, not an internal poll loop) — the native module must preserve that single-pass contract exactly.

### Dependencies on other sub-issues

None in this batch — depends on the already-migrated `issue-state` command, not on any of the other 8 scripts here.
