# Plan: Add Issue Monitoring Skill

Issue: [29-add-issue-monitoring-skill.md](../issues/29-add-issue-monitoring-skill.md)

## Overview

Create a new `monitor-issues` skill that continuously polls GitHub for issues created by the current user, writing parsed metadata (timestamps, tags) to a shared JSON state file under `.claude/state/`. Extract tag-parsing logic from `auto-fix-all/scripts/has_shipit_tag.sh` into a top-level `_lib/tags.sh` shared library so both skills can reuse it.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

### Script invocation (architect → scripter)

The `SKILL.md` invokes the monitoring script with no arguments:
```
scripts/monitor_issues.sh
```
The script runs in the foreground and blocks forever (the skill is a blocking loop).

### `_lib/tags.sh` interface (scripter → architect + future callers)

A top-level shared library at `_lib/tags.sh`, sourced by scripts that need tag extraction:

```bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../_lib/tags.sh"
# (path relative to a script inside <skill>/scripts/)
```

Functions exposed:
- `extract_tags <text>` — prints all `:token:` tag names found in `<text>`, one per line, with the surrounding colons stripped (e.g. `shipit`, `+1`). Prints nothing if none found.
- `has_tag <text> <tag>` — exits 0 if `extract_tags <text>` contains `<tag>` (case-insensitive), exits 1 otherwise.

### Issue state JSON schema (scripter → architect)

`.claude/state/issues.json` — a JSON object keyed by issue ID (string):

```json
{
  "<issue_id>": {
    "updated_at": "<ISO8601>",
    "tags": ["<tag>", ...]
  }
}
```

- `updated_at`: the timestamp written when the issue was last processed (set to the clock time of processing, **not** the issue's own `updated_at` from GitHub).
- `tags`: list of extracted tag names (colons stripped).
- Missing key = issue has never been processed.

The file is written with the existing lock mechanism: `_acquire_lock` / `_release_lock` from `auto-fix-all/scripts/queue.sh` pattern. The monitoring script implements its own lock using the same `.lock` file convention under `.claude/state/`.

### Last-checked timestamp (internal to monitor_issues.sh)

Stored in `.claude/state/issue-monitor-last-checked.txt` as a raw ISO8601 string. Written at the very start of each poll round (before the API call), with 1 second subtracted from the current time, so any issue updated during parsing is not missed.
