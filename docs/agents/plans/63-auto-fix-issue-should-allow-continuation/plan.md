# Plan: auto-fix-issue should allow continuation

Issue: [63-auto-fix-issue-should-allow-continuation.md](../issues/63-auto-fix-issue-should-allow-continuation.md)

## Overview

Introduce a single per-issue state file (`.claude/state/issue-<id>.json`) that consolidates all per-issue/per-PR runtime state across skills. Wire `auto-fix-issue` to record each completed step into this file and to resume from the recorded step when re-invoked. Migrate `monitor-issues` and `auto-monitor-pr` onto the same per-id file convention.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

### State file path and schema

All scripts and markdown steps refer to the per-issue state file as:

```
.claude/state/issue-<id>.json
```

**Schema:**

```json
{
  "step": "<step_name>",
  "updated_at": "<ISO8601>",
  "tags": ["<tag>", ...],
  "comments": [
    {"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open|addressed"}
  ],
  "last_comment_time": "<ISO8601>"
}
```

All fields are optional and default to empty/absent. The `step` field records the last completed step of `auto-fix-issue`. The `tags`/`updated_at` fields replace `monitor-issues`' `issues.json` entry. The `comments`/`last_comment_time` fields replace `auto-monitor-pr`'s per-PR JSON file.

### Step names (for `auto-fix-issue`)

The `step` field uses these canonical names (matching the step that was **completed**):

| Value | Meaning |
|-------|---------|
| `plan_located` | Step 1 (locate issue + plan) completed |
| `branch_created` | Step 2 (create branch) completed |
| `agents_listed` | Step 3 (list plan agents) completed |
| `agents_dispatched` | Step 4 (dispatch agents) completed |
| `reviewed` | Step 5 (review results) completed |
| `pr_published` | Step 6 (PR opened/marked ready) completed |

### Script: `issue_state.sh` (new, in `auto-fix-issue/scripts/`)

Signature:

```
issue_state.sh get <id> <field>           → prints value or empty, exits 0
issue_state.sh set <id> <field> <value>   → writes field, exits 0
issue_state.sh set-json <id> <field> <json_value>  → writes JSON field, exits 0
```

Used by wrapper scripts and markdown steps to safely read/write `issue-<id>.json` using the lock pattern from `monitor-issues`.

### Script: `monitor_pr.sh` new signature

`monitor_pr.sh` gains a second argument `<id>`:

```
monitor_pr.sh <pr_number> <id>
```

When `<id>` is supplied, the script reads/writes `.claude/state/issue-<id>.json` for `comments`/`last_comment_time` instead of `.claude/state/auto-monitor-pr-<pr_number>-comments.json`. When `<id>` is absent or empty, it falls back to the old per-PR file (backward-compatible).
