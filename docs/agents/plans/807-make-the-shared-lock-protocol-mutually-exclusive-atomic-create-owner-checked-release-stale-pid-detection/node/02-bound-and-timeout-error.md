# Add the optional bound and LockTimeoutError

- Add `core/lib/utils/file/LockTimeoutError.js`: `class LockTimeoutError extends Error`, with `name = 'LockTimeoutError'`, `code = 'LOCK_TIMEOUT'`, a `lockFile` property, and a message such as `Timed out waiting for lock <lockFile>; if no process holds it, remove it by hand.` Default export, matching the one-class-per-file convention.
- Extend `acquire(lockFile, { timeoutMs, warn = true } = {})`:
  - If `timeoutMs` is `undefined`, wait forever (the current behaviour, and what every existing caller gets).
  - Otherwise compute a deadline at the start. Before each retry sleep, if the remaining time is ≤ 0, throw `LockTimeoutError`, and clamp the sleep to the remaining time. `timeoutMs: 0` therefore makes one create attempt (plus a stale break, which still counts as the same attempt) and then throws.
  - A timeout never leaves a file this instance wrote. Our file only exists after a successful `wx` create, which returns immediately.
  - `warn: false` suppresses the "seems stuck" warning.
- Validate `timeoutMs`: a non-negative finite number, else throw a `TypeError`. The CLI validates user input separately.

## Files to Change
- `core/lib/utils/file/LockTimeoutError.js` — new error class.
- `core/lib/utils/file/Lock.js` — `timeoutMs` / `warn` options on `acquire`.
