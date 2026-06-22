---
name: push-issue-to-queue
description: Pushes one or more issue IDs onto the end of the auto-fix-all queue, to be processed later. Usage: /push-issue-to-queue <id1> <id2> ...
---

You are acting as the **architect**. Your job is to append the given issue IDs to the end of the `auto-fix-all` queue — no questions to the user, no confirmation loop.

## Step 1 — Push the IDs

Parse the issue IDs from the raw skill arguments (space-separated, with or without a leading `#` on each). Run:

```bash
../auto-fix-all/scripts/queue.sh push <id1> <id2> ...
```

This appends the IDs to the end of `.claude/state/auto-fix-all-queue.txt`, guarded by the same lock `auto-fix-all/scripts/queue.sh` uses for `pop`, so a concurrent `auto-fix-all` run popping the current issue can't race with this push.

## Step 2 — Report

Report the script's output verbatim (e.g. `Pushed: 30 31`). No further action is needed — `auto-fix-all` will pick up the new IDs once it reaches the end of its current queue.
