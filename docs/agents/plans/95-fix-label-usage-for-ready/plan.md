# Plan: Fix label usage for Ready

Issue: [95-fix-label-usage-for-ready.md](../issues/95-fix-label-usage-for-ready.md)

## Overview

Repoint the `clipboard` canonical tag from the overloaded `Ready` GitHub label to a new dedicated `Ready for Work` label, so `monitor-issues` only auto-enqueues issues developers explicitly mark for pickup, while `Ready` keeps existing as a plain "well-defined" label with no automated meaning.

## Context

`_lib/tags.sh` currently maps the `clipboard` canonical tag to the `Ready` label in both directions. Developers also use `Ready` informally to mean "well-defined," which causes unintended auto-enqueuing into `auto-fix-all`. The fix adds a new label (`Ready for Work`) and moves the `clipboard` mapping to it, without removing `Ready` from `init-claude`'s default label set. No migration of already-open `Ready`-labeled issues is in scope — they simply won't auto-enqueue until someone manually relabels them.

## Implementation Steps

### Step 1 — Add the `Ready for Work` label to `init-claude`'s defaults

In `init-claude/scripts/lib/label_config.sh`'s `DEFAULT_LABEL_PAIRS` array, add:
```
Ready for Work:ffaa04
```
Keep the existing `Ready:247b61` entry untouched — it is not being removed.

### Step 2 — Repoint the `clipboard` tag in `_lib/tags.sh`

- In `_tag_label_for`, change the `clipboard)` case from `echo "Ready"` to `echo "Ready for Work"`.
- In `_tag_for_label`, change the case that currently returns `clipboard` for `Ready)` to instead match `"Ready for Work")` and return `clipboard`. Remove the `Ready)` case entirely (or leave it falling through unmatched) so the plain `Ready` label no longer maps to any canonical tag.
- Update the mapping table comment at the top of the file (`clipboard   Ready` → `clipboard   Ready for Work`) to stay in sync.

### Step 3 — Update architecture docs

In `docs/agents/architecture.md`:
- Update the Issue Tags table row `| \`clipboard\` | \`Ready\` |` to `| \`clipboard\` | \`Ready for Work\` |`.
- Update the `**clipboard**` paragraph's reference to the `Ready` label to `Ready for Work`.

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `Ready for Work:ffaa04` to `DEFAULT_LABEL_PAIRS` (Step 1)
- `_lib/tags.sh` — repoint `clipboard` mapping from `Ready` to `Ready for Work` in both direction functions and the header comment (Step 2)
- `docs/agents/architecture.md` — update the Issue Tags table and `clipboard` description (Step 3)

## Notes

- No script changes are needed in `monitor-issues/scripts/monitor_issues.sh` — it dispatches on the canonical tag name (`clipboard`), which is unaffected; only the underlying label changes.
- No migration path for issues already labeled `Ready` — confirmed out of scope during issue discussion.
- Existing repos that already ran `init-claude` won't have the new label synced to GitHub automatically; that only happens the next time `init-claude`'s label sync runs. Not a blocker for this change.
