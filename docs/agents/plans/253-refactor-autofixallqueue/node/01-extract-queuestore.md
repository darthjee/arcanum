# Extract QueueStore

Create `core/lib/QueueStore.js`: a generic (not `AutoFixAll`-prefixed) class that owns the queue file's pure I/O, with no GitHub or lock dependency.

Move from `AutoFixAllQueue.js`, renaming each to drop the leading underscore:

- `_readQueue(repoPath)` → `read(repoPath)` — same behavior: absent/empty file reads as `[]`, otherwise `JSON.parse`s the file content.
- `_writeQueue(repoPath, entries)` → `write(repoPath, entries)` — same behavior: `mkdir -p` the containing dir, then write pretty-printed JSON with a trailing newline.
- `_queueFile(repoPath)` → `queueFile(repoPath)` — resolves `.claude/state/auto-fix-all-queue.json` under `repoPath`.
- `_lockFile(repoPath)` → `lockFile(repoPath)` — resolves `.claude/state/auto-fix-all-queue.lock` under `repoPath`. Stays on `QueueStore` even though `AutoFixAllQueue` is the one that acquires/releases the lock — `QueueStore` is the natural owner of both path constants (`QUEUE_RELATIVE_PATH`/`LOCK_RELATIVE_PATH` also move here).

`QueueStore`'s constructor takes no required dependencies (matches the issue's `new QueueStore()` default).

## Files to Change
- `core/lib/QueueStore.js` — new file; the extracted class described above.
