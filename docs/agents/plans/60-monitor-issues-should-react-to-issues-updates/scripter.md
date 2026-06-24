# Scripter Plan: Monitor issues should react to issues updates

Main plan: [plan.md](plan.md)

## Shared contracts

- Create `monitor-issues/scripts/rewrite_queue.sh` with `push <id>` (and `pop` for symmetry/testability, even though `architect`'s new skill owns calling `pop`) — copy the lock/mutate/release pattern from `auto-fix-all/scripts/queue.sh` exactly (lock file `.claude/state/monitor-issues-rewrite-queue.lock`, queue file `.claude/state/monitor-issues-rewrite-queue.json`, schema `[{"id": "<issue_id>"}, ...]`).
- `monitor_issues.sh`'s `pencil2` case must call this script's `push` subcommand instead of just logging, and that call's exit status is what decides whether `updated_at` gets written for that issue (see deferral contract below).

## Implementation Steps

### Step 1 — Add `--state open` to both `gh issue list` invocations
In `monitor-issues/scripts/monitor_issues.sh`, both branches of `_poll_once` (the `$GH_USER`-set branch and the fallback branch) already pass `--state all`. Change both to `--state open` so closed issues are never fetched or processed.

### Step 2 — Create `monitor-issues/scripts/rewrite_queue.sh`
New script, modeled directly on `auto-fix-all/scripts/queue.sh` (read it first for the exact locking/JSON-mutation pattern — same `_acquire_lock`/`_release_lock` shape already used inside `monitor_issues.sh` itself for `issues.json`, but this is a separate lock file/queue so it doesn't collide).

- `rewrite_queue.sh push <id>`: appends `{"id": "<id>"}` to the queue file if not already present (idempotent — pushing the same id twice is a no-op), under lock. Exit 0 on success.
- `rewrite_queue.sh pop`: removes and prints the first element's `id` (plain text, just the id) under lock, or prints nothing and exits 1 if the queue is empty. (This subcommand exists for `architect`'s new `auto-rewrite-issue` skill to consume — confirm the exact contract with `architect` before finalizing the output format, in case it needs the full JSON object rather than the bare id.)
- Source `_lib_origin.sh` the same way `monitor_issues.sh`/`github.sh` already do in this folder, for repo-ref resolution if needed (likely not needed for pure queue mutation, but check `auto-fix-all/scripts/queue.sh` for what it actually sources).

### Step 3 — Wire the `pencil2` dispatch case to push to the new queue
In `monitor_issues.sh`'s actionable-tag dispatch loop (the `while IFS= read -r ACTION_TAG` block), change the `pencil2)` case from a log-only line to:

```bash
pencil2)
  _log "Issue #${ISSUE_ID} has actionable tag 'pencil2' — pushing to rewrite queue"
  "$REWRITE_QUEUE_SCRIPT" push "$ISSUE_ID" || { _log "ERROR: failed to push #${ISSUE_ID} to the rewrite queue"; PENCIL2_FAILED=1; }
  ;;
```

Define `REWRITE_QUEUE_SCRIPT="${SCRIPT_DIR}/rewrite_queue.sh"` near the existing `QUEUE_SCRIPT` definition at the top of the file.

Note: pushing to a queue is the *dispatched action* for `pencil2` in this iteration — the actual rewrite happens later, asynchronously, when `architect`'s new skill drains the queue. This matches how `clipboard` already works (push now, processing happens later in `auto-fix-all`). The success/failure that gates `updated_at` (Step 4 below) is about whether the *push* succeeded, not whether the rewrite itself succeeded — that's an explicit, accepted scope boundary: once an id is durably queued, this poll cycle's job for that issue is done. (If `architect`/the issue author wants stronger guarantees — i.e. only mark `updated_at` once the rewrite itself completes — flag that back, since it would require a different mechanism, like the rewrite skill writing back to `issues.json` itself after popping. Implement the simpler queue-push-gates-updated_at version first and call out the limitation in the PR description.)

### Step 4 — Defer the `updated_at` write until after dispatch
Currently `_write_issues` (recording `updated_at`/`tags` for the issue) runs *before* the actionable-tag dispatch loop. Restructure so that:

1. Tags are still extracted and logged immediately (no behavior change there).
2. The actionable-tag dispatch loop runs, tracking whether any dispatched action for *this issue* failed (e.g. a local `ISSUE_DISPATCH_FAILED=0` flag reset per issue, set to `1` on any failure from `clipboard`'s existing `QUEUE_SCRIPT push` call or the new `pencil2` `REWRITE_QUEUE_SCRIPT push` call).
3. Only if `ISSUE_DISPATCH_FAILED` is still `0` after the loop, acquire the lock and call `_write_issues` to record `updated_at`/`tags` for this issue. If any dispatch failed, skip the write entirely for this issue (log a line saying so) — the next poll cycle will see the same `GH_UPDATED_AT > STORED_UPDATED_AT` and retry.
4. `question`-tagged issues have no dispatched action at all (still log-only) — for those, `updated_at` is written immediately as before (no behavior change; nothing to gate on).

Be careful with variable scoping/locking: the lock is currently acquired once per issue iteration around the `_write_issues` call — keep that, just move the acquire/write/release block to *after* the dispatch loop instead of before it.

## Files to Change
- `monitor-issues/scripts/monitor_issues.sh` — `--state open`, `REWRITE_QUEUE_SCRIPT` var, `pencil2` dispatch case, restructured `_poll_once` to defer `updated_at` write.
- `monitor-issues/scripts/rewrite_queue.sh` — new file, `push`/`pop` subcommands.

## Notes
- No CI config exists in this repo — no `## CI Checks` section. Verify manually: run `monitor-issues/scripts/monitor_issues.sh` against a sandbox/test repo state if available, or at minimum `bash -n monitor-issues/scripts/monitor_issues.sh` and `bash -n monitor-issues/scripts/rewrite_queue.sh` for syntax, plus a manual dry run of `rewrite_queue.sh push`/`pop` against a throwaway state file.
- Confirm the exact `pop` output contract (bare id vs JSON) with `architect` before finalizing, since `architect`'s `auto-rewrite-issue` skill is the consumer.
