# Plan: discuss-issue should fetch the issue through a script

Issue: [71-discuss-issue-should-fetch-the-issue-through-a-script.md](../issues/71-discuss-issue-should-fetch-the-issue-through-a-script.md)

## Overview

Move `issue_state.sh` from `auto-fix-issue/scripts/` into `_lib/` so it becomes a shared library script available to all skills, then update `_lib/github_issue.sh`'s `cmd_fetch` to persist issue metadata (`title`, `state`, `updated_at`, `tags`) into `.claude/state/issue-<id>.json` immediately after a successful GitHub fetch.

## Context

`_lib/github_issue.sh` currently saves the issue body to `docs/agents/issues/<id>-<title>.md` and strips the tags block from the body, but writes nothing to the per-issue JSON state file (`.claude/state/issue-<id>.json`). Tags and metadata are only returned inline via `TAGS_BEGIN`/`TAGS_END` output and are never persisted, making them invisible to `monitor-issues`, `auto-monitor-pr`, and other skills that read from the state file.

The `issue_state.sh` implementation lives only in `auto-fix-issue/scripts/`, but is already used by `monitor-issues/scripts/monitor_issues.sh` and `auto-monitor-pr/scripts/monitor_pr.sh` via relative paths pointing back to that location. Moving it to `_lib/` and leaving a thin wrapper there makes the shared intent explicit and keeps all callers working unchanged.

## Implementation Steps

### Step 1 — Move `issue_state.sh` to `_lib/`

Copy the full implementation of `auto-fix-issue/scripts/issue_state.sh` into `_lib/issue_state.sh` verbatim (no logic changes).

### Step 2 — Replace `auto-fix-issue/scripts/issue_state.sh` with a thin wrapper

Replace the implementation in `auto-fix-issue/scripts/issue_state.sh` with a thin exec-delegation wrapper (same pattern as `_lib/resolve_id_and_file.sh`):

```bash
#!/usr/bin/env bash
# Thin wrapper — delegates to the canonical copy in _lib/
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../../_lib/issue_state.sh" "$@"
```

All existing callers (`monitor_issues.sh`, `monitor_pr.sh`, `auto-fix-issue/steps/run.md`) continue to work unchanged because the wrapper preserves the exact same interface.

### Step 3 — Update `_lib/github_issue.sh` `cmd_fetch` to persist metadata

After saving the `.md` file and before printing output, `cmd_fetch` should:

1. Source `_lib/tags.sh` (via `SCRIPT_DIR`) to gain access to `extract_tags`.
2. Extract `updated_at`, `title`, and `state` from the GitHub API JSON response (already fetched).
3. Parse the tags from `tags_block` using `extract_tags` and build a JSON array of `:word:` tokens (e.g. `[":shipit:", ":eyes:"]`).
4. Call `_lib/issue_state.sh` (via `SCRIPT_DIR`) to write each field:
   - `issue_state.sh set-json <id> tags <json_array>` — persists the tags array.
   - `issue_state.sh set <id> updated_at <value>` — persists the ISO8601 timestamp.
   - `issue_state.sh set <id> title <value>` — persists the title string.
   - `issue_state.sh set <id> state <value>` — persists `"open"` or `"closed"`.

The tags JSON array must wrap each tag name with colons: if `extract_tags` produces bare names like `shipit eyes`, the array must be `[":shipit:", ":eyes:"]`.

If `tags_block` is empty, write an empty JSON array `[]` for `tags`.

## Files to Change

- `_lib/issue_state.sh` — new file; the canonical implementation moved from `auto-fix-issue/scripts/`
- `auto-fix-issue/scripts/issue_state.sh` — replace implementation with thin exec-delegation wrapper pointing to `_lib/issue_state.sh`
- `_lib/github_issue.sh` — extend `cmd_fetch` to source `tags.sh` and write the four metadata fields to `.claude/state/issue-<id>.json` via `issue_state.sh`

## Notes

- `monitor_issues.sh` and `monitor_pr.sh` both resolve `issue_state.sh` via `../../auto-fix-issue/scripts/issue_state.sh` — the thin wrapper at that path means they require no changes.
- `_lib/github_issue.sh` should locate sibling scripts using `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` (already the pattern for `_load_origin`-style helpers in the file) to keep paths portable.
- No CI configuration was found in this repository, so there are no local check commands to run beyond bash syntax validation.
