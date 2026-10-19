# Plan: Make the shared lock protocol mutually exclusive (atomic create, owner-checked release, stale-pid detection)

Issue: [807-make-the-shared-lock-protocol-mutually-exclusive-atomic-create-owner-checked-release-stale-pid-detection.md](../../issues/807-make-the-shared-lock-protocol-mutually-exclusive-atomic-create-owner-checked-release-stale-pid-detection.md)

## Overview

Replace the write → sleep → re-read lock protocol in both `arcanum/_lib/lock.sh` and `core/lib/utils/file/Lock.js` with an atomic create-if-absent acquire, an owner-checked release, and same-host dead-pid stale detection, using one shared, parseable instance id format so shell and native writers exclude each other. `Lock.js` also gains an optional time bound (`timeoutMs`) that throws `LockTimeoutError`; `lock.sh` keeps waiting forever. `issue_state_shell.sh` drops its inline copy of the old protocol and sources `lock.sh`. Docs are updated to match.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

Both implementations must agree byte-for-byte on the lock file, since shell and native writers share the same `<file>.lock`.

- **Instance id format:** `<hostname>:<pid>:<nonce>`.
  - `<hostname>`: Node `os.hostname()`; bash `${HOSTNAME:-$(hostname)}` (no more literal `host` fallback). Hostnames never contain `:`.
  - `<pid>`: decimal integer. Node `process.pid`; bash `${BASHPID:-$$}` (BASHPID is absent on macOS bash 3.2).
  - `<nonce>`: any string without `:` and whitespace that is unique per acquire call. Node `${Date.now()}-${process.hrtime.bigint()}`; bash `$(date +%s)-${RANDOM}${RANDOM}` (macOS `date` has no `%N`).
  - A fresh id is generated **per acquire call**, and the holder remembers it until release.
- **Lock file content:** the id followed by a single `\n`. Readers compare the **trimmed** content to an id.
- **Acquire:** create the file atomically only if absent (Node `writeFile(lockFile, id + '\n', { flag: 'wx' })`; bash `( set -o noclobber; printf '%s\n' "$id" > "$LOCK_FILE" ) 2>/dev/null`). Success → held immediately, no sleep. File exists → run the stale check, then sleep the retry interval (default 1s) and retry.
- **Parsing someone else's id:** split the trimmed content on `:`. It is parseable only if there are exactly 3 parts and the pid is `^[0-9]+$`. Anything else (old-protocol `host-pid-…` ids, empty file, hand-written content) is **unparseable**, so it is never stale.
- **Stale rule:** a lock is stale only if it is parseable, its hostname equals ours, and its pid is not alive. Liveness: Node `process.kill(pid, 0)` → alive, `ESRCH` → dead, `EPERM` → alive. Bash `kill -0 "$pid" 2>/dev/null` → alive; otherwise `ps -p "$pid" >/dev/null 2>&1` → alive (another user's process); otherwise dead.
- **Breaking a stale lock:** re-read the file immediately before removing it; remove only if the trimmed content still equals the stale id just observed; then retry the atomic create at once (no sleep). The residual race between that re-read and the remove is accepted and documented.
- **Release:** remove the file only if its trimmed content equals this holder's id. Otherwise (missing, or someone else's), do nothing, silently. Calling release without holding the lock is a safe no-op. `monitor_issues_shell.sh` relies on this via `trap '_release_lock' EXIT`.
- **Warning:** unchanged text and cadence. It fires once per acquisition after 10 consecutive failed attempts (`Warning: lock (<file>) seems stuck after <n> attempts — …`). Stale-break retries do not count as failed attempts.
- **Retry interval overrides (tests only):** Node `new Lock({ sleepMs })` (existing option; now means the retry sleep on contention). Bash `ARCANUM_LOCK_RETRY_SLEEP` env var, defaulting to `1`.
- **Bound (Node only):** `acquire(lockFile, { timeoutMs, warn } = {})`. If `timeoutMs` is omitted, it waits forever. `0` means one create attempt (plus a stale break if needed). On exhaustion it throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`, `lockFile` property, message naming the lock file) and has written nothing. `warn: false` suppresses the "seems stuck" warning (default `true`). `lock.sh` has no bound.
- **Unchanged:** lock file paths (`<file>.lock` and the named lock files), caller APIs (`_acquire_lock` / `_release_lock` with `LOCK_FILE`, `Lock#acquire(lockFile)` / `Lock#release(lockFile)`), and no config/state file shape changes, so no migration.
