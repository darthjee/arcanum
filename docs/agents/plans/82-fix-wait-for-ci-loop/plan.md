# Plan: Fix Wait For CI Loop

Issue: [82-fix-wait-for-ci-loop.md](../issues/82-fix-wait-for-ci-loop.md)

## Overview

Strengthen the CI-wait instructions in `auto-fix-all/steps/process_one_issue.md` so the architect agent never falls back to a self-waking polling loop when waiting for CI. The change is a targeted editorial addition to a single markdown file.

## Context

During an `auto-fix-all` run the architect agent used `ScheduleWakeup` to poll CI in a loop rather than delegating to the blocking script `scripts/wait_ci.sh`. The script already handles all polling internally; the problem was that the step instructions did not explicitly forbid self-waking mechanisms, leaving the agent free to improvise. The fix is to add a hard prohibition and specify a sufficiently high Bash timeout so the blocking call completes without interruption.

## Implementation Steps

### Step 1 — Add a hard prohibition and timeout note to the wait_ci.sh call

In `auto-fix-all/steps/process_one_issue.md`, find the "Wait for CI" bullet inside the "If `approved`" section:

```
2. Wait for CI:
   ```bash
   scripts/wait_ci.sh
   ```
   This blocks until every check-run registered on the PR's head commit completes...
```

Expand it to include:
- A **NEVER** line that explicitly forbids `ScheduleWakeup`, self-waking loops, and any other polling mechanism for CI.
- A note that the Bash tool call must set `timeout: 600000` (10 minutes — the maximum the tool supports) so the call cannot time out before CI finishes.

The prohibition must be visually prominent (e.g. bold or a `> **NEVER …**` blockquote) so it is hard to miss.

## Files to Change

- `auto-fix-all/steps/process_one_issue.md` — add explicit prohibition against self-waking CI polling and specify `timeout: 600000` for the Bash tool call.

## Notes

- No scripts need to change; `scripts/wait_ci.sh` already blocks correctly.
- No other skill files reference a CI-wait pattern that would also need updating.
- Keep the diff minimal — only the "Wait for CI" block needs to change.
