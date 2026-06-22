# Plan: Store last commit information in centralized issue file

Issue: [23-store-last-commit-information-in-centralized-issue-file.md](../../issues/23-store-last-commit-information-in-centralized-issue-file.md)

## Overview
`auto-monitor-pr/scripts/monitor_pr.sh` currently keeps two separate state files per PR: a plain-text `since.txt` holding the last-seen owner-comment timestamp, and a JSON `comments.json` tracking each owner comment's lifecycle. This plan merges the timestamp into the existing JSON file as a new field, so a single file holds all per-PR monitoring state, and removes the `since.txt` file entirely.

## Context
- `SINCE_FILE=".claude/state/auto-monitor-pr-${PR_NUMBER}-since.txt"` is read at the top of the polling loop (default `"1970-01-01T00:00:00Z"` when missing) and written every time new owner comments are found (`echo "$latest_time" > "$SINCE_FILE"`).
- `COMMENTS_FILE=".claude/state/auto-monitor-pr-${PR_NUMBER}-comments.json"` already exists and has the shape `{"comments":[{id,user,url,status}]}`, loaded/saved via the `load_comments_state`/`save_comments_state` helpers.
- The fix is to add a `last_comment_time` field alongside `comments` in that same JSON object, and route all reads/writes of the timestamp through it instead of `SINCE_FILE`.

## Implementation Steps

### Step 1 — Extend the JSON schema and default
Change `load_comments_state` so the default value (when the file doesn't exist) is `{"comments":[],"last_comment_time":"1970-01-01T00:00:00Z"}` instead of `{"comments":[]}`. This keeps a single default literal as the source of truth for "no state yet".

### Step 2 — Replace the since-file read
Remove the `SINCE_FILE` variable and the block that reads `last_time` from it. Instead, derive `last_time` directly from the already-loaded `comments_state` via `jq -r '.last_comment_time'`, after the "resolve previously-open comments" block that already loads `comments_state` at the top of the script.

### Step 3 — Replace the since-file write
Where the script currently does `mkdir -p "$(dirname "$SINCE_FILE")"; echo "$latest_time" > "$SINCE_FILE"`, instead update `comments_state` to set `.last_comment_time = $latest_time` (via `jq`) and rely on the existing `save_comments_state` call (already invoked right after recording the new comments) to persist it — both the comment-status updates and the timestamp update should be folded into the same `comments_state` object before that single `save_comments_state` call, avoiding a second write.

### Step 4 — Remove now-unused since-file references
Delete the `SINCE_FILE` variable declaration and update the script's header comment block (currently documenting `SINCE_FILE`/`since.txt` behavior) to describe the merged `last_comment_time` field on `COMMENTS_FILE` instead.

### Step 5 — Manual verification
Since this project has no automated test suite (markdown/bash skills only), verify by running the script (or a focused excerpt) against a test PR/mock `gh` responses, confirming: first run with no state file defaults the timestamp correctly, a run with new comments persists `last_comment_time` into the JSON file, and no `since.txt` file is created.

## Files to Change
- `auto-monitor-pr/scripts/monitor_pr.sh` — merge `last_comment_time` into the JSON state object; remove `SINCE_FILE` and its read/write sites; update the header comment.

## Notes
- No other script reads `since.txt` directly (confirmed: `monitor_pr.sh` is its only producer/consumer), so removal is safe without a migration step.
- Existing `.claude/state/auto-monitor-pr-*-since.txt` files left over from before this change are harmless leftovers; no cleanup script is needed since they're simply never read again.
