# Specs, including a shell-vs-native race

Rewrite `core/spec/lib/utils/file/Lock_spec.js`, which today documents and tests the old non-exclusive behaviour, so remove those comments and the `_read` spy test. Use `sleepMs: 5`.

- Acquire on an absent file resolves without sleeping (spy on `_sleep`, expect no calls) and writes `<hostname>:<pid>:<nonce>\n`.
- Still creates parent directories.
- Waits on an existing live lock (a file written by hand with `${os.hostname()}:${process.pid}:x`) and acquires once the test removes it.
- Two `Lock` instances racing with `Promise.all` never both hold the lock: wrap each in acquire → read counter → await a tick → write counter+1 → release, run many iterations, and assert no lost update.
- One instance holding two different lock files at once releases each correctly.
- Owner-checked release: after acquire, overwrite the file with a foreign id, then `release` leaves it intact. `release` without holding is a no-op.
- Stale break: same hostname plus a dead pid (spawn and await a short-lived child process, then use its pid) is broken and acquired. Same hostname plus a live pid is not. A cross-host id and an old-format id (`host-123-456`) are never broken (`timeoutMs: 50` → `LockTimeoutError`).
- Bound: `timeoutMs: 0` on a held lock throws `LockTimeoutError` (`code === 'LOCK_TIMEOUT'`, `lockFile` set) and leaves the foreign file byte-identical. `timeoutMs` succeeds if the lock is released before the deadline. `warn: false` suppresses the warning after 10 attempts (spy on `process.stderr.write`). An invalid `timeoutMs` throws `TypeError`.
- **Cross-implementation race:** spawn `bash -c` that sources `arcanum/_lib/lock.sh` (resolved relative to the spec file, from the repo root) with `ARCANUM_LOCK_RETRY_SLEEP=0.01` and loops acquire → increment counter file → release, concurrently with a native `Lock` loop doing the same on the same counter and lock file. Assert the final counter equals the total number of increments. Skip with a clear `pending()` if `bash` isn't available.
- Run the consumer specs (`RepoConfigWriter_spec`, `BooleanKeyConfig_spec`, `AutoFixAllQueuePush_spec`, `issueStateWriteSharedExamples`, `PermissionGrant_spec`, …) unchanged and confirm they pass.

## Files to Change
- `core/spec/lib/utils/file/Lock_spec.js` — rewritten for the new protocol, the bound, and the cross-implementation race.
- `core/spec/lib/utils/file/LockTimeoutError_spec.js` — small spec for the error's `name` / `code` / `lockFile` / message.
