# Scripter Plan: Docker engine: migrate GitHub API commands (batch 3)

Main plan: [plan.md](plan.md)

## Shared contracts

Add `--needs=global-config,gitconfig,gh` to every batch-3 `engine_dispatch` call, plus the `--path-arg` flags in [plan.md → Shared contracts](plan.md#shared-contracts) for `github-issue-create`, `github-issue-update`, `spawn-issue`, `auto-fix-issue-github-pr-create` and `init-claude-sync-labels`. Keep `HOME` in each allowlist.

## Implementation Steps

### Step 1 — Declare docker needs in the batch-3 shims

Add the flags to these calls:

- `arcanum/_lib/github_issue.sh`: all 10 subcommands (`info`, `create`, `fetch`, `update`, the 6 `mark-*`).
- `arcanum/_lib/resolve_and_fetch.sh`, `arcanum/_lib/spawn_issue.sh`.
- `arcanum-split-issue/scripts/create_sub_issue.sh`, `push_sub_issues.sh`.
- `auto-fix-all/scripts/github.sh`: `pr-number`, `pr-state`, `pr-merge`, `has-label`, `has-shipit-label`, `add-tag`, `remove-tag`. Not `cleanup-branch`.
- `auto-fix-all/scripts/queue.sh`: `save`, `push` only.
- `auto-fix-all/scripts/wait_ci.sh`, `wait_ci_and_merge.sh`.
- `auto-fix-issue/scripts/github.sh`: `pr-create`, `pr-view`, `pr-ready`. Not `info`.
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`.
- `init-claude/scripts/sync_labels.sh`.
- `monitor-issues/scripts/github.sh` (`remove-tag`) and `monitor_issues.sh`.

Outside the docker path the flags are ignored, so shell and native behavior does not change. In each shim header, add a short paragraph in the batch-1/2 style: under `engine.mode=docker` the command runs in the container with the repo mount, the global-config and gitconfig `:ro` mounts (plus the path-arg mount where present), and a host-resolved `GH_TOKEN` forwarded by name. It falls back to native when Docker is unavailable. Where a header names a now-wrong shell implementation detail, such as `resolve_and_fetch.sh`'s note about `gh auth token` being called deeper, keep it accurate for docker.

Run `arcanum/_lib/test_engine_dispatch.sh`. If a case relies on one of these keys being `native` in the real map, switch it to a temporary map, as batch 1 did.

### Step 2 — Flip status, tick the checklist, add notes

Do this only after node's gh parity suite has run green once.

- `arcanum/_lib/migration-status.json`: set the 31 keys to `"docker"`, then regenerate the entrypoint migration status table with the generator batches 1 and 2 used.
- `docs/agents/specs/docker/checklist.md`: tick the 31 rows ✅ with `#747`, and check each row's `mounts`/`env` against the shim flags. In `notes`, record which command has no parity case and why:
  - creates issues: `github-issue-create`, `spawn-issue`, `arcanum-split-issue-create-sub-issue`, `arcanum-split-issue-push-sub-issues`
  - overwrites an issue body: `github-issue-update`
  - creates or changes PRs: `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-ready`, `auto-fix-all-github-pr-merge`
  - edits repo labels: `init-claude-sync-labels`
  - blocks on CI: `auto-fix-all-wait-ci`, `auto-fix-all-wait-ci-and-merge`
  - long-running loop: `monitor-issues-monitor-issues`

  For each of these, also note that the routing spec covers the wiring. Add any finding node reports, for example about the backgrounded `monitor_issues.sh` container.
- `docs/agents/specs/docker.md`: extend the status line to mention batch 3 (#747), the first batch using gh token forwarding.

## Files to Change

- The 14 shim files listed in Step 1: flags + header paragraph.
- `arcanum/_lib/test_engine_dispatch.sh`: only if a case depends on these keys being native.
- `arcanum/_lib/migration-status.json` and the generated status table: 31 keys → `docker`.
- `docs/agents/specs/docker/checklist.md`: 31 rows ticked, notes.
- `docs/agents/specs/docker.md`: batch 3 status note.

## Notes

- Do not touch the `remote`-tagged gh rows (`arcanum-split-issue-finish`, `auto-fix-all-reply-comment`, `auto-monitor-pr-monitor-pr`, `auto-fix-all-github-cleanup-branch`) or the `native-only` `arcanum-create-issue-*` rows.
- Don't change the token-forwarding code itself unless node's parity run exposes a bug. If it does, fix it in this PR and say so in the PR body.
