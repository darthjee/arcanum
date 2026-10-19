# Rewrite Lock.js acquire/release

In `core/lib/utils/file/Lock.js`:

- `_newId()` returns `${os.hostname()}:${process.pid}:${Date.now()}-${process.hrtime.bigint()}`.
- Track held ids per lock file in a `Map` (`lockFile → id`) on the instance, so one `Lock` instance can hold several different lock files at once (consumers share a single default instance).
- `acquire(lockFile)`: `mkdir -p` the parent (as today), make a fresh id, then loop:
  - `writeFile(lockFile, `${id}\n`, { flag: 'wx' })`. On success, record the id and return.
  - On `EEXIST`, read the holder (`_read`, trimmed). If it is empty or missing, retry immediately. If it is stale per the shared contract (parseable, same hostname, `process.kill(pid, 0)` throws `ESRCH`), re-read, `rm` only if it is unchanged, and retry immediately without counting an attempt.
  - Otherwise `_sleep(this._sleepMs)`, count the attempt, and keep the existing warn-once-every-10 logic and text.
  - Rethrow any other fs error.
- `release(lockFile)`: if this instance holds an id for `lockFile` and the file's trimmed content equals it, `rm` it. Always drop the map entry. Never throw for a missing or foreign file.
- Factor the parse/liveness checks into small private helpers (`_parseId`, `_isStale`) so specs can target them. Update the class JSDoc to describe the new protocol (drop the "write, sleep, re-read" text).

## Files to Change
- `core/lib/utils/file/Lock.js` — new atomic acquire, owner-checked release, stale detection, per-file held ids.
