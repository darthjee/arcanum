# Issue: Add a skill to push issues to auto-fix-all queue

## Description
`auto-fix-all` consumes a queue of issue ids from `.claude/state/auto-fix-all-queue.txt` (plain text, one id per line, first line = currently in-progress id), managed via `auto-fix-all/scripts/queue.sh` (`save`, `next`, `pop`). There is currently no skill that lets a user or agent append new issue ids to this queue while it may be in use, and no locking exists around queue file writes — `pop` relies on an atomic `tail`+`mv`, but concurrent writers could still race.

## Problem
- No skill exists to push one or more issue ids onto the end of the `auto-fix-all` queue.
- Queue manipulation has no locking, so concurrent writers (`push`, and the existing `pop`/`save` in `queue.sh`) could race and corrupt the queue file.

## Expected Behavior
- A new skill accepts one or more issue ids and appends them to the end of the existing queue, to be picked up later by `auto-fix-all`.
- All manipulation of the queue file — both the new push and the existing `pop` — goes through the same centralized locking logic, so concurrent invocations don't corrupt the file.

## Solution
- Add a script (likely in `auto-fix-all/scripts/`, e.g. extending `queue.sh`) with a `push <id...>` command that appends ids to the end of the queue.
- Implement locking inside the script before any write:
  - Create a lock file under `.claude/state` named using the issue id, containing an identifier for the running Claude instance/agent.
  - Sleep 1 second.
  - Re-check that the lock file still holds this instance's identifier (to detect a lost race).
  - Perform the write (append the id(s) to the queue, or remove the head id for `pop`).
  - Remove the lock file.
- Update `queue.sh`'s existing `pop` command to use this same locking logic, not just the new `push` command.
- Add a new skill (e.g. `push-issue-to-queue`) whose SKILL.md documents the usage (`/push-issue-to-queue <id1> <id2> ...`) and calls this script.

## Benefits
- Lets users/agents queue up new issues for `auto-fix-all` without manually editing the queue file.
- Centralizes and protects queue mutations against race conditions from concurrent writers.

---
See issue for details: https://github.com/darthjee/arcanum/issues/25
