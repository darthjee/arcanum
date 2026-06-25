# Issue: Store comments information in issue json

## Description
When monitoring a PR (in `auto-fix-all`, `auto-monitor-pr`, or `auto-monitor-issue-pr` skills), the `monitor_pr.sh` script fetches PR comments and tracks their state. Currently, these comments are stored in the issue state JSON (`.claude/state/issue-<id>.json`) under a `comments` field with two states: `open` and `addressed`.

This issue expands the comment storage to include bot-added reaction tracking and a three-state lifecycle, and renames the field from `comments` to `pr_comments`.

## Problem
The current `comments` array in the issue state JSON has two gaps:
- **Reaction tracking**: no field records which bot-added emoji reactions are present on a comment (:eyes:, :+1:)
- **Granular lifecycle**: the two-state model (`open`/`addressed`) cannot distinguish a freshly-detected comment from one the bot has already reacted to with :eyes:. If the script crashes between detecting a comment and reacting to it, there is no way to know the reaction was never applied.

## Expected Behavior
The field `comments` in the issue state JSON is replaced by `pr_comments` (an array of objects, no backward-compatibility migration). Each comment object includes:
- `emojis`: list of bot-added reactions currently on the comment (e.g. `[":eyes:"]`, `[":+1:"]`)
- `state`: one of three values:
  - `fetched`: comment detected, no bot reaction added yet (brief transient — also serves as crash-recovery signal)
  - `processing`: bot has reacted with :eyes:
  - `addressed`: bot has reacted with :+1:

No migration of existing `comments` entries is performed — old data is dropped and the new schema is applied from the next monitoring run onward.

## Solution
Update `monitor_pr.sh` to:
1. Replace all writes to `comments` with writes to `pr_comments`
2. Set `state: fetched` immediately on detection (before applying any reaction), then update to `processing` after :eyes: is added and `addressed` after :+1: is added
3. Track bot-added reactions in an `emojis` array on each comment object
4. Update `issue_state.sh` and the schema documentation in `architecture.md` to reflect the new field name and shape
