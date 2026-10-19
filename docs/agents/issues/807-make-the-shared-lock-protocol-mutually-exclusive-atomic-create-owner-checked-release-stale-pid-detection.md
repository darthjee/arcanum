# Issue: Make the shared lock protocol mutually exclusive (atomic create, owner-checked release, stale-pid detection)

## Description

Surfaced while enhancing #773 (epic #767, Arcanum CLI shared config logic). The decision to fix the shared protocol (rather than give the CLI a private lock) is recorded in `docs/agents/specs/arcanum-cli/shared-config-logic.md#lock`. #807 stays standalone, outside epic #767, but is a **hard blocker** for the CLI's write commands (`docs/agents/specs/arcanum-cli/command-surface.md#lock-contention`).

## Problem

The shared lock protocol — `arcanum/_lib/lock.sh` and its native mirror `core/lib/utils/file/Lock.js` (see `docs/agents/architecture/lock-system.md`) — is **not mutually exclusive against a writer that already holds the lock**. Acquire is: write my id unconditionally, sleep 1s, re-read, "held" if my id is still there. Nothing checks whether the lock file already exists. So:

1. Writer A acquires `<file>.lock` and starts its read-merge-write.
2. Writer B arrives, overwrites the lock file with its own id, sleeps 1s, re-reads, sees its own id, and "acquires".
3. A and B now mutate the same file concurrently — one update is lost silently.
4. Whichever finishes first `rm -f`s the lock file, deleting the other's lock.

The protocol only arbitrates writers that arrive within the same ~1s window. This affects every lock user today: the `auto-fix-all` queue (`queue_common.sh`, `AutoFixAllQueue`), repo/global config writes (`repo_config.sh`, `global_config.sh`, `RepoConfigWriter`, `BooleanKeyConfig`), monitor-issues state/config/rewrite queue, issue state (`issue_state_shell.sh`, `IssueState`, `IssueStateService`), permission grants, migrations ledger/errors files, and the docker image lock (`engine_dispatch_docker.sh`).

In addition, `arcanum/_lib/issue_state_shell.sh` carries its own **inline copy** of the old protocol instead of sourcing `lock.sh`, so a fix to `lock.sh` alone would miss it.

## Expected Behavior

- At most one writer holds a given `<file>.lock` at a time, regardless of arrival timing, across shell and native writers.
- A writer only ever deletes a lock file it owns.
- A lock left behind by a dead process on the same host is broken automatically; a lock from another host (or one whose owner can't be determined) keeps today's warn-once-after-10-attempts behaviour.
- Uncontended acquisition is immediate (no fixed 1s sleep).
- Skills keep waiting forever; `Lock` callers can opt into a bound.

## Solution

Change both implementations together (and keep them byte-compatible on the lock file):

- **Acquire — atomic create-if-absent.** Create the lock file only if absent, writing the instance id in the same step.
  - Node: `writeFile(lockFile, id, { flag: 'wx' })`; `EEXIST` → wait and retry.
  - Bash: `( set -o noclobber; echo "$id" > "$LOCK_FILE" )` (`O_EXCL` under `noclobber`; works on macOS and Linux bash, no new dependency).
  - The write → sleep → re-read dance goes away. The retry sleep on contention stays (1s, `sleepMs` still overridable in tests).
- **Release — owner-checked.** Delete the lock file only if it still contains this instance's id; never a blind `rm -f`.
- **Shared, parseable instance id.** Both sides write the same unambiguous format, e.g. `<hostname>:<pid>:<nonce>` (hostnames may contain dashes, so `-` is not a safe separator). Bash drops the `${HOSTNAME:-host}` fallback and uses the real hostname so it matches Node's `os.hostname()`. Ids that cannot be parsed in the new format (old-protocol writers, hand-written files) are **never** treated as stale — they get the cross-host behaviour.
- **Stale-lock detection.** If the parsed hostname equals ours and the pid is not alive (`kill -0` / `process.kill(pid, 0)`, treating `EPERM` as alive), the lock is stale. Break it by **re-reading the lock immediately before removing it and removing only if it still holds the same stale id**, then retry the atomic create. This leaves a microsecond window between re-read and remove (two waiters breaking the same stale lock); document it in `lock-system.md` as an accepted residual race. Cross-host / unparseable locks keep today's behaviour (warn once after 10 attempts, suggest manual removal).
  - Note: under the docker engine, native writers run in a container with its own hostname and pid namespace, so their leftover locks are seen as cross-host from the host — safe (never wrongly broken), just not auto-broken.
- **Optional bound (Node only).** `Lock#acquire(lockFile, { timeoutMs })`: omitted → wait forever (skills' default); `0` → try once; on exhaustion throw a `LockTimeoutError` (exported from `core/lib/utils/file/`) with `code: 'LOCK_TIMEOUT'` and a message naming the lock file. A timeout means the file existed for the whole wait — nothing was written, nothing to clean up. The CLI's error layer (epic #767) later maps `LOCK_TIMEOUT` → exit `6`; `ConfigError` is not introduced here. Callers using a bound suppress the "seems stuck" warning (the CLI prints its own timeout message) — expose this as an option, e.g. `{ warn: false }`. `lock.sh` gains no bound.
- **De-duplicate `issue_state_shell.sh`.** Delete its inline `_acquire_lock` / `_release_lock` / `_LOCK_INSTANCE_ID` and source `arcanum/_lib/lock.sh` instead.
- **Docs.** Rewrite `docs/agents/architecture/lock-system.md` to describe the new protocol (atomic acquire, owner-checked release, id format, stale detection and its residual race, optional bound, mixed-version behaviour, and its current list of users). Update the `Lock.js` / `lock.sh` header comments to match.

### Backward compatibility

The npm CLI may be newer than the arcanum install it writes to, so old- and new-protocol writers can coexist. A new writer waits on an old writer's file (and never stale-breaks it, since an old id doesn't parse); an old writer can still overwrite a new writer's file, exactly as today. A mix is never worse than the current state, and becomes fully exclusive once both sides are upgraded. No config/state file shape changes, so no per-repo migration.

### Out of scope

- `arcanum/update/updater.sh`'s `mkdir`-based `.arcanum-update.lock` — already atomic, unrelated protocol.

### Testing strategy

- `Lock.js` specs: acquire on absent file is immediate; waits on an existing file and acquires once it is released; owner-checked release leaves a foreign lock intact; same-host dead-pid lock is broken; same-host live-pid lock is not; cross-host and unparseable ids are never broken; `timeoutMs` (including `0`) throws `LockTimeoutError` without writing the lock file.
- Shell tests for `lock.sh` mirroring the above (no bound), plus `issue_state_shell.sh` still passing its existing tests after sourcing `lock.sh`.
- Existing specs that construct `new Lock({ sleepMs: 5 })` keep working.
- A concurrency test: two writers (shell + native) racing on the same file never both hold the lock, and no update is lost.

### Owners

`node` (`core/lib/utils/file/Lock.js`, the new error, specs) and `scripter` (`arcanum/_lib/lock.sh`, `arcanum/_lib/issue_state_shell.sh`, shell tests). Architect for `docs/agents/architecture/lock-system.md`.

## Benefits

- Eliminates silent lost updates on the `auto-fix-all` queue, config tiers, and issue/monitor state.
- Removes the fixed 1s penalty on every uncontended lock acquisition.
- Crashed writers no longer block others forever on the same host.
- Unblocks the Arcanum CLI's write commands (epic #767).
