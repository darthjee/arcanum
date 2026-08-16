# Lock System

The lock system prevents concurrent mutations of shared JSON state files. Currently used by `auto-fix-all/scripts/queue.sh` for `push` and `pop` operations on the queue.

**Lock file:** `.claude/state/auto-fix-all-queue.lock`

**Mechanism:**
1. Write a unique instance ID (hostname + PID + timestamp) into the lock file.
2. Sleep 1 second.
3. Re-read the lock file — if it still contains this instance's ID, the lock is held; otherwise another writer won the race, so retry from step 1.
4. Perform the mutation.
5. Delete the lock file to release.

**Properties:**
- Never gives up — retries indefinitely.
- After 10 consecutive failed attempts, prints a warning once suggesting manual inspection and removal of a potentially stale lock file.
- If a process crashes while holding the lock, the lock file can be removed by hand to unblock other writers.

**Rule for implementers:** any script that mutates a shared JSON file must go through the lock/mutate/release sequence above. Never write the queue JSON (or other shared state) directly without holding the lock.
