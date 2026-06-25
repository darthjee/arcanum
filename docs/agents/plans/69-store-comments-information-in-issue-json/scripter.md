# Scripter Plan: Store Comments Information in Issue Json

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

### Step 1 — Update `load_comments_state` to read `pr_comments`

In `auto-monitor-pr/scripts/monitor_pr.sh`, the `load_comments_state` function currently reads `.comments // []` from the issue state file and constructs a JSON object with key `"comments"`. Change it to read `.pr_comments // []` and return an object with key `"pr_comments"`.

### Step 2 — Update `save_comments_state` to write `pr_comments`

The `save_comments_state` function currently calls `issue_state.sh set-json "$ISSUE_ID" comments "$comments"`. Change the field name argument from `comments` to `pr_comments`. No other argument changes needed — `issue_state.sh` is a generic key-value store.

### Step 3 — Update open-comment resolution at startup to use new field/state

The script resolves "open" comments at startup (comments left `open` by the previous run are now addressed because a fix was pushed). Update this block:

- Read `state == "processing"` instead of `status == "open"` when selecting which comments to finalize.
- After swapping `:eyes:` for `:+1:` on each, update those entries: set `state: "addressed"` and `emojis: [":+1:"]`.
- The overall `.comments` key in jq filters becomes `.pr_comments`.

### Step 4 — Update new-comment recording to implement the three-state lifecycle

When new comments are found (the `count -gt 0` branch), replace the current one-shot write with a three-phase sequence:

1. **Phase 1 — write `fetched`:** Immediately persist all new comments with `state: "fetched"` and `emojis: []`. This is the crash-recovery checkpoint — if the script dies after this point, the next run can detect un-reacted comments.
2. **Phase 2 — add reactions and update to `processing`:** For each new comment node id, call `add_reaction "$node_id" EYES`. After each successful reaction (or after the whole batch), update those entries in the state to `state: "processing"` and `emojis: [":eyes:"]`, then persist again.
3. **Phase 3 — print output and exit:** Print `"commented"` followed by the comment blocks (unchanged format), then exit 0.

The existing `load_comments_state` / `save_comments_state` helpers are used in each phase.

### Step 5 — Update the script header comment

The top-of-file comment block documents the old field name (`comments`) and the old two-state model. Update it to:
- Reference `pr_comments` instead of `comments`.
- Describe the three states (`fetched`, `processing`, `addressed`) and the `emojis` field.
- Note that the `comments` key in the legacy per-PR file (`.claude/state/auto-monitor-pr-<pr_number>-comments.json`) is untouched — that deprecated path is not part of this change.

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr.sh` — all five steps above

## Notes

- `auto-fix-issue/scripts/issue_state.sh` does not need changes; it is a generic field-level accessor that takes the field name as an argument.
- No migration logic is needed; old `comments` entries in existing state files are silently ignored once the script starts writing `pr_comments`.
- The deprecated per-PR file path (when `--issue-id` is not passed) uses its own JSON object with a `comments` key — that path is out of scope for this issue and must remain unchanged.
