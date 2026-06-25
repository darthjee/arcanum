# Scripter Plan: auto-fix-issue should allow continuation

Main plan: [plan.md](plan.md)

## Shared contracts

This agent implements all new and modified scripts. The state file path/schema and `issue_state.sh` script signature are defined in `plan.md` — implement them exactly as specified there. The `monitor_pr.sh` new signature is also defined there.

## Implementation Steps

### Step 1 — Create `auto-fix-issue/scripts/issue_state.sh`

New script. Implements safe read/write of `.claude/state/issue-<id>.json` using the lock-file pattern already used by `monitor-issues` (write unique instance id, sleep 1s, re-read to confirm, mutate, delete lock file).

Signature:

```
issue_state.sh get <id> <field>                   → prints value or empty string, exits 0
issue_state.sh set <id> <field> <value>            → sets string field, exits 0
issue_state.sh set-json <id> <field> <json_value>  → sets JSON field (array/object), exits 0
```

State file path: `.claude/state/issue-<id>.json`
Lock file: `.claude/state/issue-<id>.lock`

- `get`: read the JSON file (default `{}`), extract `.field` via jq, print to stdout.
- `set`: acquire lock → read file → set `.field = $value` (string) → write → release lock.
- `set-json`: same but value is parsed as raw JSON (use `jq --argjson`).

If the state directory does not exist, create it (`mkdir -p`).

### Step 2 — Update `auto-monitor-pr/scripts/monitor_pr.sh` to use per-issue file

Add a second optional argument `<id>`:

```
monitor_pr.sh <pr_number> [<id>]
```

When `<id>` is non-empty, derive the comments file as `.claude/state/issue-<id>.json` (reading/writing the `comments` and `last_comment_time` fields inside it) instead of `.claude/state/auto-monitor-pr-<pr_number>-comments.json`.

When `<id>` is absent or empty, keep the old behavior (backward-compatible).

Implementation notes:
- The existing `load_comments_state` / `save_comments_state` helpers currently read/write the whole file as the comments state object. With the new unified file, they must instead read the file's `comments` array and `last_comment_time` field, and write back only those two fields (leaving other fields like `step`, `tags`, `updated_at` untouched).
- Use `issue_state.sh set-json <id> comments <json>` and `issue_state.sh set <id> last_comment_time <value>` for writes, or inline jq mutations (your choice — consistency with the rest of the file is preferred).
- For reads, load the unified file and extract `.comments // []` and `.last_comment_time // "1970-01-01T00:00:00Z"`.

### Step 3 — Update `monitor-issues/scripts/monitor_issues.sh` to write per-issue file

Replace the current write to `.claude/state/issues.json` with a write to `.claude/state/issue-<id>.json` (using `issue_state.sh set` / `issue_state.sh set-json`, or direct jq + lock inline).

Specifically, replace:

```bash
UPDATED_ISSUES=$(echo "$CURRENT_ISSUES" | jq \
  --arg id "$ISSUE_ID" \
  --arg updated_at "$NOW" \
  --argjson tags "$TAGS_JSON" \
  '.[$id] = {"updated_at": $updated_at, "tags": $tags}'
)
_write_issues "$UPDATED_ISSUES"
```

With writes to the per-id file:

```bash
issue_state.sh set "$ISSUE_ID" updated_at "$NOW"
issue_state.sh set-json "$ISSUE_ID" tags "$TAGS_JSON"
```

(or inline jq equivalent with the lock pattern).

Also update `_read_issues` / stored-updated-at reads:

Replace:
```bash
STORED_UPDATED_AT=$(
  _read_issues | jq -r --arg id "$ISSUE_ID" '.[$id].updated_at // "1970-01-01T00:00:00Z"'
)
```

With:
```bash
STORED_UPDATED_AT=$(issue_state.sh get "$ISSUE_ID" updated_at)
STORED_UPDATED_AT="${STORED_UPDATED_AT:-1970-01-01T00:00:00Z}"
```

Remove the `_read_issues` / `_write_issues` / `ISSUES_FILE` / `LOCK_FILE` (issues-specific) helpers and variables that are now unused, unless they are still needed elsewhere in the script.

The per-issue lock file (`.claude/state/issue-<id>.lock`) is handled by `issue_state.sh` — no separate lock needed in `monitor_issues.sh`.

### Step 4 — Resolve `issue_state.sh` path in `monitor_issues.sh`

`monitor_issues.sh` is in `monitor-issues/scripts/`. `issue_state.sh` lives in `auto-fix-issue/scripts/`. Resolve via:

```bash
ISSUE_STATE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../auto-fix-issue/scripts/issue_state.sh"
```

Set this near the top of the script, alongside the other script-path variables.

## Files to Change

- `auto-fix-issue/scripts/issue_state.sh` — new script (create)
- `auto-monitor-pr/scripts/monitor_pr.sh` — add optional `<id>` arg; use per-issue file when given
- `monitor-issues/scripts/monitor_issues.sh` — replace `issues.json` writes with per-id file via `issue_state.sh`

## Notes

- `issue_state.sh` is the single source of truth for reading/writing `.claude/state/issue-<id>.json`. Any future skill that needs per-issue state should go through it.
- Do not delete `.claude/state/issues.json` or `.claude/state/auto-monitor-pr-<pr_number>-comments.json` at runtime — backward compat is handled by keeping the old fallback path in `monitor_pr.sh` when `<id>` is absent.
- The lock file for the per-issue state is `.claude/state/issue-<id>.lock`. Use the same pattern as `monitor-issues`' `_acquire_lock` / `_release_lock`.
- Make the new `issue_state.sh` executable (`chmod +x`).
