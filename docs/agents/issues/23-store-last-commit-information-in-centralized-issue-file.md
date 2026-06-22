# Issue: Store last commit information in centralized issue file

## Description
`auto-monitor-pr/scripts/monitor_pr.sh` currently tracks the last-seen commit time in a separate plain-text file (`.claude/state/auto-monitor-pr-<pr_number>-since.txt`), stored alongside the existing per-PR JSON state file (`.claude/state/auto-monitor-pr-<pr_number>-comments.json`) that already carries the PR's comment tracking data.

## Problem
- Monitoring state for a single PR is split across two separate files (a `.txt` and a `.json`), making it harder to reason about and maintain as a unit.
- The `.json` file already exists as the natural place to centralize this kind of state.

## Expected Behavior
- The last commit time should be stored as a field inside the existing per-PR JSON state file, rather than in its own `.txt` file.
- Reads and writes of the last commit time should go through the JSON file instead of the separate `since.txt`.

## Solution
- Add a `last_commit_time` (or similarly named) field to the JSON schema used by `monitor_pr.sh`.
- Update the script's read logic (currently defaulting to `1970-01-01T00:00:00Z` when no prior value exists) and write logic (currently writing `latest_time` to the `.txt` file) to use the JSON file instead.
- Remove the now-unused `since.txt` file handling.

## Benefits
- Single source of truth for per-PR monitoring state.
- Simplifies state management and reduces the number of files to track/clean up.

---
See issue for details: https://github.com/darthjee/arcanum/issues/23
