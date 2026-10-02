---
name: push-issue-to-queue
description: Pushes one or more issue IDs onto the end of the auto-fix-all queue, to be processed later. Refuses issues labelled Epic (split those with /arcanum-split-issue). Usage: /push-issue-to-queue <id1> <id2> ...
---

You are acting as the **architect**. Your job is to append the given issue IDs to the end of the `auto-fix-all` queue — no questions to the user, no confirmation loop.

## Step 1 — Refuse Epics, then push the remaining IDs

Resolve `REPO_PATH="$(pwd)"` — the one moment the target project's root can be trusted from ambient cwd. Parse the issue IDs from the raw skill arguments (space-separated, with or without a leading `#` on each).

For each id, check whether it is an Epic:

```bash
../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic
```

- Exit `0` — the issue is an Epic. Print `#<id> is an Epic — split it with /arcanum-split-issue` and leave that id out.
- Any non-zero exit — treat it as not an Epic and keep the id (a label-fetch failure must not block the push; `auto-fix-all` re-checks after popping).

Then, if any ids remain, run **one** push with all of them, in their original order:

```bash
../auto-fix-all/scripts/queue.sh push "$REPO_PATH" <remaining ids…>
```

Skip the push entirely when no ids remain.

This appends the IDs to the end of `.claude/state/auto-fix-all-queue.txt`, guarded by the same lock `auto-fix-all/scripts/queue.sh` uses for `pop`, so a concurrent `auto-fix-all` run popping the current issue can't race with this push.

## Step 2 — Report

Report each refusal line from Step 1 first, then the push script's output verbatim (e.g. `Pushed: 30 31`), if a push ran. No further action is needed — `auto-fix-all` will pick up the new IDs once it reaches the end of its current queue.
