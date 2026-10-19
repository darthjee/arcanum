# Add a standalone shell test for lock.sh

Add `arcanum/_lib/test_lock.sh`, a standalone regression script in the style of `test_origin_resolution.sh` (`set -uo pipefail`, `fail()`, temp dir cleaned up by `trap`, exit 0 on success). Run it with `ARCANUM_LOCK_RETRY_SLEEP=0.05` so it stays fast. Cases:

1. Acquire on an absent file is immediate (well under 1s), the file holds `<host>:<pid>:<nonce>`, and release removes it.
2. With a foreign live lock (`$(hostname):$$:x` written by hand, so the pid is alive), a background `_acquire_lock` keeps waiting. Once the file is removed, it acquires.
3. Owner-checked release: after acquiring, overwrite the file with a foreign id, then `_release_lock` and assert the foreign file is still there.
4. Release with nothing held is a no-op (exit 0, foreign file untouched).
5. Stale break: write `$(hostname):<dead pid>:x` (spawn `sleep 0 &`, `wait` it, and use its pid), then acquire succeeds and the file holds our id.
6. A cross-host id (`some-other-host:1:x`) and an old-format id (`host-123-456`) are never broken. Acquire in the background, assert it is still waiting after a few retry intervals, then kill it.
7. Mutual exclusion: N background subshells each loop acquire → read a counter file → sleep briefly → write counter+1 → release. Assert the final counter equals the total number of increments (no lost update).

## Files to Change
- `arcanum/_lib/test_lock.sh` — new standalone test script.
