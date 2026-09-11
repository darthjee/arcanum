# Plan: Migrate auto-monitor-pr-monitor-pr entrypoint to native Node.js

Issue: [436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js.md](../../issues/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-monitor-pr/scripts/monitor_pr.sh` — the single-pass PR merge/close/approval/new-comment poller, and the most complex script in the `auto-monitor-pr`/`auto-monitor-issue-pr` migration batch — to a native `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js` command, following the exact shim/dispatch pattern already used by sibling issues #431–#435. `node` builds the native implementation and its tests; `scripter` turns `monitor_pr.sh` into a thin `engine_dispatch` shim backed by an unchanged `monitor_pr_shell.sh`.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command name**: `auto-monitor-pr-monitor-pr` — the `migration-status.json` key and `core/bin/arcanum` routing key `node` registers, and the literal string `scripter`'s shim passes to `engine_dispatch`.
- **Native module**: `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js`, exporting a class with an async `run(...args)` method, registered in `core/lib/core/commands.js` with `context: 'repo'` (the command needs `repoContext.repoPath` for both state-file I/O and GitHub origin/token resolution).
- **CLI surface (unchanged)**: `monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]` — `scripter`'s shim strips `<repo_path>` (consumed by `engine_dispatch` itself) and forwards `--pr-number`/`--issue-id` verbatim as `args` to `core/bin/arcanum auto-monitor-pr-monitor-pr`; `node`'s `run()` parses those same flags itself (mirroring `resolve_pr_number_shell.sh`'s pattern of the shim owning `repo_path` and the command owning its own flag parsing).
- **Env allowlist**: the shim forwards `HOME` only (same rationale as `resolve_pr_number.sh`/`run_checks.sh`'s shims — `gh auth token` resolution needs it once native's `env -i` strips the ambient environment).
- **Output/exit-code contract (byte-identical to `monitor_pr_shell.sh`, all exit 0 on every non-usage path)**:
  - `merged\n` — PR is merged (state-file for the run's mode is deleted first).
  - `closed\n` — PR is closed, not merged.
  - `approved\n` — PR owner's latest review is `APPROVED`, or a new owner comment is exactly `:shipit:` (whitespace-tolerant).
  - `commented\n` followed by, per new owner comment, `---\nid: <id>\nurl: <url>\n<body>\n`.
  - `pending\n` — nothing new this pass, or any transient `gh`/API error along the way.
  - Usage error (missing/empty `--pr-number`, or an unrecognized flag): `Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]` on stderr, exit 1 — this is the one path the shim must NOT swallow into the dispatch guard's shell-fallback machinery; both the shell and native sides must independently produce this exact message/exit combination since a caller may hit it before `engine_dispatch` ever runs (see `resolve_pr_number.sh`'s precedent — the shim passes `$@` through untouched and lets whichever implementation runs do its own usage validation).
- **State-file dual shape (read `monitor_pr.sh` in full, not just its header comment, before implementing this — see the Notes callout below)**:
  - `--issue-id <id>` given → read/write `pr_comments` (array) and `last_comment_time` (ISO 8601 string) fields inside `.claude/state/issue-<id>.json`, via the same shape `IssueStateService#get`/`#setJson`/`#set` already support (mirrors `resolve_pr_number_shell.sh`'s existing use of `issue_state.sh`).
  - `--issue-id` absent → read/write the SAME `{"pr_comments": [...], "last_comment_time": "..."}` JSON object, but as the whole content of `.claude/state/auto-monitor-pr-<pr_number>-comments.json` (a plain file, no lock/merge semantics needed — the shell's `save_comments_state` else-branch is a flat overwrite).
  - Each `pr_comments[]` entry: `{id, user, url, state, emojis}` where `state` cycles `fetched` → `processing` → `addressed`, and `emojis` is `[]` / `[":eyes:"]` / `[":+1:"]` respectively.

## Notes

- The shell script's own header comment (lines 27–29) claims the legacy per-PR file "retains its own JSON object with a `comments` key" — this does NOT match the actual code: `save_comments_state`'s else-branch writes the exact same `{pr_comments, last_comment_time}` shape as the issue-state path, just to a different file. Trust the code, not the stale comment, when porting — and the parity test must exercise the legacy (`--issue-id`-absent) file path, not just describe it.
- No dependency on the other sub-issues in this batch (per the issue file) — only on the already-migrated `issue-state` command.
