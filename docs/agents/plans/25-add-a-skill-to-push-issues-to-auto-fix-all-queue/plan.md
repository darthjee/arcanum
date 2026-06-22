# Plan: Add a skill to push issues to auto-fix-all queue

Issue: [25-add-a-skill-to-push-issues-to-auto-fix-all-queue.md](../../issues/25-add-a-skill-to-push-issues-to-auto-fix-all-queue.md)

## Overview
Add a `push` command to the existing centralized queue script (`auto-fix-all/scripts/queue.sh`) that appends one or more issue ids to the end of the queue, guarded by a simple lock so it can't race with the existing `pop` command. Expose `push` to users/agents via a new top-level skill, `push-issue-to-queue`, that's just a thin SKILL.md calling the script.

## Context
- The queue lives in `.claude/state/auto-fix-all-queue.txt` (one id per line, first line = current in-progress id), managed exclusively by `auto-fix-all/scripts/queue.sh` (`save`, `next`, `pop`, `empty`, `list`).
- No locking exists today. `pop` does `tail -n +2 file > file.tmp && mv file.tmp file`, which is atomic for that single operation but offers no protection if a `push` (new) and a `pop` run concurrently against the same file.
- Per the issue's own follow-up clarification, the existing `pop` command must also go through the new locking, not just the new `push` command.

## Implementation Steps

### Step 1 — Add a shared lock helper inside `queue.sh`
Add two internal functions to `queue.sh`:
- `_acquire_lock` — writes a generated instance identifier (e.g. `${HOSTNAME:-host}-$$-$(date +%s%N)`) into a lock file, sleeps 1 second, then re-reads the lock file: if it still contains this instance's identifier, the lock is held; otherwise another instance won the race and this attempt retries (small bounded retry loop, e.g. 10 attempts, to avoid an infinite hang under real contention — the issue describes the single-attempt mechanics, the retry wrapper is needed to make it actually usable).
- `_release_lock` — removes the lock file.

**Design note (deviation from the issue's literal wording):** the issue suggests naming the lock file "using the issue id in the file name." Because `push` can receive multiple ids in one call and `pop` operates on whichever id currently happens to be at the head of the queue (not an id passed as an argument), naming the lock per-id would let a concurrent `push` and `pop` take out *different* lock files and never actually exclude each other — defeating the purpose of the lock (protecting the single shared queue file). Instead, use one fixed lock file for the whole queue resource: `.claude/state/auto-fix-all-queue.lock`. This still satisfies the issue's actual goal (no concurrent corruption of the queue file) while the per-id naming would not.

### Step 2 — Add the `push <id...>` command
Add a new case to `queue.sh`'s command dispatch: validates at least one id was given (same validation style as `save`), acquires the lock, appends the given ids to the end of `QUEUE_FILE` (`printf '%s\n' "$@" >> "$QUEUE_FILE"`), releases the lock, and prints `Pushed: <ids>`.

### Step 3 — Wrap `pop` with the same lock
Update the existing `pop` case to acquire the lock before the `tail`/`mv` sequence and release it after, mirroring `push`. Keep `pop`'s existing no-op behavior when the queue file doesn't exist (check that before acquiring the lock, so a missing file doesn't need a lock at all).

### Step 4 — Update the script's header comment
Extend the comment block at the top of `queue.sh` to document the new `push` command and the locking behavior shared by `push` and `pop`.

### Step 5 — Add the `push-issue-to-queue` skill
Create `push-issue-to-queue/SKILL.md` with frontmatter `name: push-issue-to-queue` and a description covering "pushes one or more issue ids onto the end of the auto-fix-all queue." Its single step parses the raw skill arguments (space-separated ids) and runs:
```bash
../auto-fix-all/scripts/queue.sh push <id1> <id2> ...
```
(relative path from the new skill folder to `auto-fix-all/scripts/queue.sh`, the same cross-skill relative-path pattern already used elsewhere, e.g. `auto-monitor-issue-pr/SKILL.md` referencing `../auto-monitor-pr/SKILL.md`). Report the script's output verbatim. No new script is needed for this skill — it's a direct call into the already-centralized `queue.sh`.

### Step 6 — Update project docs
- `docs/agents/folder-structure.md` — add a row for `push-issue-to-queue/`.
- `README.md` — add a row for `/push-issue-to-queue` to the "Available skills" table.

## Files to Change
- `auto-fix-all/scripts/queue.sh` — add `_acquire_lock`/`_release_lock` helpers, the `push` command, lock the `pop` command, update header comment.
- `push-issue-to-queue/SKILL.md` — new file.
- `docs/agents/folder-structure.md` — new row.
- `README.md` — new row in the skills table.

## Notes
- No automated test suite exists in this repo; verify by running `queue.sh push <id>` and `queue.sh pop` directly and inspecting the resulting `.claude/state/auto-fix-all-queue.txt` and confirming the lock file is removed afterward in both cases.
- The lock mechanism implemented here is optimistic/best-effort (matches the issue's own description), not a hardened distributed lock — acceptable given this tool only ever runs a handful of local Claude Code instances against the same repo, never high-concurrency production traffic.
