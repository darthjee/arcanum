# Plan: Loop through issues popping

Issue: [28-loop-through-issues-popping.md](../../issues/28-loop-through-issues-popping.md)

## Overview

`auto-fix-all` currently stops the whole skill the moment the queue is empty. We make the empty-queue case wait and retry instead of terminating, by extracting that retry loop into `queue.sh` (per this repo's convention of pushing deterministic logic into scripts) and updating the orchestration markdown to use it.

## Context

`scripts/queue.sh next` prints the first queue ID, or an empty string when the queue has no items. `steps/process_next.md` currently treats an empty result as "the queue is done" and sends the flow straight to `SKILL.md`'s Step 4 (report and stop). Since `push-issue-to-queue` (issue #25) lets new IDs be appended to the queue at any time, an `auto-fix-all` run that happens to drain the queue should keep waiting for more work instead of exiting — otherwise issues pushed afterwards are never picked up automatically.

## Implementation Steps

### Step 1 — Add a blocking `wait-next` command to `queue.sh`

Add a new case to `auto-fix-all/scripts/queue.sh`, alongside the existing `next`, that polls the queue and blocks until it has an item:

```
wait-next   — like `next`, but if the queue is empty, sleep 5s and retry, forever
```

Implementation: a loop that calls the same logic as `next` (read the first line of `$QUEUE_FILE`), and if empty, `sleep 5` and loop again; once non-empty, print the ID and return. No locking is needed here since it only reads — `pop`/`push` already serialize writes.

### Step 2 — Update `process_next.md` to use `wait-next`

In `auto-fix-all/steps/process_next.md`, change step "1. Get the next ID" to call:

```bash
scripts/queue.sh wait-next
```

instead of `scripts/queue.sh next`, and remove the "If the output is empty, the queue is done" branch — `wait-next` never returns empty, so that branch can no longer be reached.

### Step 3 — Update `SKILL.md`'s description of Step 4

`SKILL.md`'s Step 4 ("Done", triggered when `scripts/queue.sh empty` exits 0) is no longer reachable through the normal flow, since Step 2 now blocks forever instead of falling through to it. Update the Step 4 text to clarify that the skill runs indefinitely by design (per the issue) and that this step only applies if the run is stopped externally — adjust the top-level skill description/intro in `SKILL.md` accordingly so it no longer reads as "process until the queue is empty" but "process forever, picking up newly pushed issues".

## Files to Change

- `auto-fix-all/scripts/queue.sh` — add the `wait-next` subcommand (sleep-and-retry loop) and its line in the usage/case statement.
- `auto-fix-all/steps/process_next.md` — call `wait-next` instead of `next`; drop the now-unreachable "queue is done" branch.
- `auto-fix-all/SKILL.md` — update the intro and Step 4 wording to describe the eternal-loop behavior instead of "until the queue is empty".

## Notes

- No CI configuration exists in this repo (markdown/shell-only skills collection), so no `## CI Checks` section applies.
- `wait-next` deliberately does not take the lock used by `push`/`pop`, since it only reads — matching how `next` already behaves today.
