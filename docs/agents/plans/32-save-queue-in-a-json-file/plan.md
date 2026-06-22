# Plan: Save queue in a json file

Issue: [32-save-queue-in-a-json-file.md](../../issues/32-save-queue-in-a-json-file.md)

## Overview
Switch the `auto-fix-all` queue persistence in `auto-fix-all/scripts/queue.sh` from a plain-text file (one ID per line) to a JSON file, while keeping every existing command (`save`, `next`, `wait-next`, `push`, `pop`, `empty`, `list`) working with the same CLI interface and the same callers (`auto-fix-all/SKILL.md`, `auto-fix-all/steps/process_next.md`, `auto-fix-all/steps/monitor_pr.md`, `push-issue-to-queue/SKILL.md`). The JSON shape stores the queue as an array of entry objects (each currently just `{"id": "<id>"}`) so future fields (issue metadata, per-entry options) can be added to an entry without changing the overall structure.

## Context
The queue currently lives at `.claude/state/auto-fix-all-queue.txt`, one numeric ID per line, with the first line always being the in-progress ID. `push`/`pop` mutate it under a simple lock file (`.claude/state/auto-fix-all-queue.lock`) using an instance-id-write-then-reread protocol to avoid clobbering concurrent writers. The issue asks for this to become a JSON file so it can later carry more information per queued item, without removing or weakening the existing locking behavior.

## Implementation Steps

### Step 1 — Switch the state file and storage format
Rename the state file from `auto-fix-all-queue.txt` to `auto-fix-all-queue.json` and change its on-disk shape to a JSON array of entry objects, e.g.:
```json
[
  {"id": "32"},
  {"id": "41"}
]
```
An empty/absent queue is represented as `[]` (or a missing file, treated the same as today).

### Step 2 — Reimplement each command against the JSON shape using `jq`
`jq` is already available in this environment and is the natural tool for shell-based JSON manipulation here (no other script in the repo depends on a JSON library, so introducing `jq` as the one dependency for this file is the smallest change):
- `save <id...>` — build a JSON array from the given IDs and overwrite the file.
- `next` — print the `id` of the first array element (empty output if the array is empty or the file doesn't exist), preserving current behavior.
- `wait-next` — same loop as today, but the "is it empty" check must inspect the JSON array length instead of file size.
- `push <id...>` — read the existing array, append new `{"id": ...}` entries, write back, under the existing lock.
- `pop` — read the existing array, drop the first element, write back, under the existing lock.
- `empty` — exit 0 when the array is empty or the file is absent, exit 1 otherwise.
- `list` — print all remaining IDs, one per line (keep the existing `(empty)` output when there are none), to avoid breaking any caller that parses this output as plain text.

### Step 3 — Preserve the locking semantics
Keep `_acquire_lock`/`_release_lock` exactly as they are (they operate on the separate `.lock` file, independent of the queue's content format) — only the read/write of `QUEUE_FILE` inside `push` and `pop` changes to go through `jq`.

### Step 4 — Update in-script documentation
Update the header comment in `queue.sh` to describe the new JSON file path and array-of-objects shape instead of "one ID per line".

## Files to Change
- `auto-fix-all/scripts/queue.sh` — change `QUEUE_FILE` to the new `.json` path and rewrite `save`/`next`/`wait-next`/`push`/`pop`/`empty`/`list` to read/write the JSON array via `jq`, keeping the existing lock mechanism and CLI/output contract (plain numeric IDs in, plain numeric IDs out) unchanged for all callers.

## Notes
- No caller of `queue.sh` (`auto-fix-all/SKILL.md`, `steps/process_next.md`, `steps/monitor_pr.md`, `push-issue-to-queue/SKILL.md`) needs to change: they only ever pass/receive plain IDs through this CLI, never touch the state file directly.
- This plan keeps each queue entry as just `{"id": "<id>"}` for now — the issue only asks for the storage format to become JSON and extensible; it does not ask for new fields to be added yet, so none are introduced speculatively.
- No CI configuration exists in this repository, so no CI Checks section applies.
