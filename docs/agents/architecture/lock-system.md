# Lock System

The lock system prevents concurrent mutations of shared JSON state files. It has two implementations that share one protocol, byte for byte, so shell and native writers exclude each other on the same lock file:

- `arcanum/_lib/lock.sh`: set `LOCK_FILE`, then call `_acquire_lock` / `_release_lock`.
- `shared/lib/file/Lock.js`: `Lock#acquire(lockFile, { timeoutMs, warn })` / `Lock#release(lockFile)`. It lives in the [Shared Lib](shared-lib.md), so `core/` and the CLI use the same code.

**Lock file:** `<file>.lock` next to the state file it protects, or a named lock file (see [Users](#users)).

## Mechanism

1. **Instance id.** Each acquire call generates a fresh id `<hostname>:<pid>:<nonce>` and remembers it until release. The lock file holds the id followed by a single `\n`. Readers compare the trimmed content to an id.
   - `<hostname>`: Node `os.hostname()`; bash `${HOSTNAME:-$(hostname)}`.
   - `<pid>`: Node `process.pid`; bash `${BASHPID:-$$}` (`BASHPID` is absent on macOS bash 3.2).
   - `<nonce>`: unique per acquire call, with no `:` or whitespace. Node `${Date.now()}-${process.hrtime.bigint()}`; bash `$(date +%s)-${RANDOM}${RANDOM}`.
2. **Acquire.** Create the lock file atomically, only if it is absent (Node `writeFile(..., { flag: 'wx' })`; bash `set -o noclobber`). If the create succeeds, the lock is held at once, with no sleep.
3. **Contention.** If the file already exists, check whether it is stale (below). If it is not stale, sleep the retry interval (1s by default) and retry from step 2.
4. **Stale detection.** A lock is stale only if its content is parseable (exactly three `:`-separated parts with a numeric pid), its hostname is ours, and its pid is not alive. Liveness: Node `process.kill(pid, 0)` (`EPERM` counts as alive); bash `kill -0`, falling back to `ps -p` for another user's process. Anything unparseable (an old-protocol `host-pid-time` id, an empty file, hand-written content) is never stale.
5. **Breaking a stale lock.** Re-read the file right before removing it, remove it only if it still holds the stale id just observed, then retry the create at once (no sleep, and it doesn't count as a failed attempt). Between that re-read and the remove, another writer could break the same lock and acquire it, and the first breaker could then remove the new holder's file. This residual race needs two writers breaking the same dead lock at the same instant, and it is accepted.
6. **Mutate**, then **release**: remove the lock file only if it still holds this holder's id. If it is missing or holds someone else's id, release does nothing, silently. Release without holding the lock is a safe no-op, so it can run from an `EXIT` trap.

Held ids are kept per lock path, so one process can hold several different lock files at once.

## Properties

- **Skills never give up.** `lock.sh` and `Lock#acquire` without `timeoutMs` retry forever.
- **Warning.** After 10 consecutive failed attempts, a single warning per acquisition (`Warning: lock (<file>) seems stuck after 10 attempts — …`) suggests checking for a holder and removing the lock file by hand. Stale-lock breaks don't count as failed attempts.
- **Crashed holders.** A lock left by a dead process on the same host is broken automatically. A cross-host lock (for example one left by a container, which has its own hostname) or an unparseable lock is never broken automatically: it still needs manual removal after the warning.
- **Optional bound (Node only).** `acquire(lockFile, { timeoutMs })` gives up once `timeoutMs` milliseconds have passed (`0` makes a single create attempt, plus a stale break if needed). It throws `LockTimeoutError` (`shared/lib/file/LockTimeoutError.js`; `code: 'LOCK_TIMEOUT'`, with a `lockFile` property and a message naming the lock file) and has written nothing. `RepoConfigWriter` passes its own optional `timeoutMs` through (see [Shared Lib → Writer API](shared-lib.md#writer-api)). `warn: false` suppresses the "seems stuck" warning. `lock.sh` has no bound.
- **Test overrides.** The retry interval can be shortened: Node `new Lock({ sleepMs })`, bash `ARCANUM_LOCK_RETRY_SLEEP` (seconds, default `1`).

## Mixed versions

An old-protocol writer (write → sleep 1s → re-read) still overwrites a held lock unconditionally, so a mix of old and new writers is no more exclusive than the old protocol alone. A new-protocol writer waits on an old writer's file, which is never stale because it is unparseable. Exclusion is complete once every writer is upgraded. The lock file paths are unchanged, so no migration is needed.

## Users

The shell callers are listed below. Their native twins in `core/lib` and `shared/lib` use `Lock.js` on the same lock files.

- `auto-fix-all` queue push/pop (`auto-fix-all/scripts/queue_common.sh`, `.claude/state/auto-fix-all-queue.lock`).
- Config tiers: repo config (`arcanum/_lib/repo_config.sh`), global config (`arcanum/_lib/global_config.sh`), and `shared/`'s `RepoConfigWriter`.
- `monitor-issues`: its config, the rewrite queue, and `.claude/state/issue-monitor.lock`.
- Issue state (`arcanum/_lib/issue_state_shell.sh`, `.claude/state/issue-<id>.lock`).
- Permission grants (`arcanum/_lib/permission_grant_shell.sh`).
- Migrations: the ledger and the errors file (`arcanum/migrations/{run,update_per_file,_ledger,ledger}.sh`).
- The docker image lock (`arcanum/_lib/engine_dispatch_docker.sh`, `${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock`).

`arcanum/update/updater.sh` uses its own `mkdir`-based lock, outside this system.

**Rule for implementers:** any script that mutates a shared JSON file must go through the lock/mutate/release sequence above. Never write the queue JSON (or other shared state) directly without holding the lock.
