# Plan: Store Comments Information in Issue Json

Issue: [69-store-comments-information-in-issue-json.md](../issues/69-store-comments-information-in-issue-json.md)

## Overview

Replace the `comments` field in `.claude/state/issue-<id>.json` with `pr_comments`, adding an `emojis` array (tracking bot-added reactions) and a three-state lifecycle (`fetched` → `processing` → `addressed`). The change touches `auto-monitor-pr/scripts/monitor_pr.sh` (all read/write paths for the comments state) and `docs/agents/architecture.md` (schema documentation).

## Agents involved

- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

### `pr_comments` field in `.claude/state/issue-<id>.json`

Each element of the `pr_comments` array has this shape:

```json
{
  "id":     "<GraphQL node id>",
  "user":   "<GitHub login>",
  "url":    "<html url>",
  "state":  "fetched | processing | addressed",
  "emojis": ["<:emoji_name:>"]
}
```

**State lifecycle:**

| state | meaning |
|-------|---------|
| `fetched` | Comment detected; no bot reaction applied yet. Transient — also a crash-recovery signal (if a run is killed between detection and reaction, the next run knows to retry the reaction). |
| `processing` | Bot has added `:eyes:` reaction. Stored as `emojis: [":eyes:"]`. |
| `addressed` | Bot has swapped `:eyes:` for `:+1:`. Stored as `emojis: [":+1:"]`. |

No backward-compatibility migration — old `comments` entries in existing state files are silently dropped; the new schema is applied from the next monitoring run onward.
