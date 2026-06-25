# Architect Plan: Store Comments Information in Issue Json

Main plan: [plan.md](plan.md)

## Shared contracts

The `pr_comments` array in `.claude/state/issue-<id>.json`. Each element:

```json
{
  "id":     "<GraphQL node id>",
  "user":   "<GitHub login>",
  "url":    "<html url>",
  "state":  "fetched | processing | addressed",
  "emojis": ["<:emoji_name:>"]
}
```

This replaces the old `comments` array (which had `status: "open" | "addressed"` and no `emojis` field).

## Implementation Steps

### Step 1 — Update the `issue-<id>.json` schema row in `architecture.md`

In `docs/agents/architecture.md`, the "Shared State & Configuration Files" table contains a row for `.claude/state/issue-<id>.json`. Its `Schema` cell currently documents the `comments` field with the old two-state shape. Update it to:

- Replace `"comments": [{"id": ..., "user": ..., "url": ..., "status": "open|addressed"}]` with `"pr_comments": [{"id": ..., "user": ..., "url": ..., "state": "fetched|processing|addressed", "emojis": ["..."]}]`.
- Keep all other fields (`step`, `updated_at`, `tags`, `last_comment_time`) unchanged.
- Keep the note that all fields are optional.

### Step 2 — Remove or update any prose that references the old `comments` field

Search `docs/agents/architecture.md` for any inline prose (outside the schema table) that mentions the `comments` field by name (e.g. in the narrative description of the `auto-monitor-pr` skill or the deprecated per-PR file). Update those references to `pr_comments`, or to the appropriate new state names, as needed.

## Files to Change

- `docs/agents/architecture.md` — schema table row for `issue-<id>.json`

## Notes

- The deprecated `.claude/state/auto-monitor-pr-<pr_number>-comments.json` file still uses `comments` — its schema row in the table should stay as-is (it is a legacy format that is not being changed).
