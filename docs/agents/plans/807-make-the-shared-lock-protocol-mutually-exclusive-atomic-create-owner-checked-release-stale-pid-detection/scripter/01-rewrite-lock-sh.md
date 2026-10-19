# Rewrite lock.sh with the new protocol

Replace the write → sleep → re-read loop in `arcanum/_lib/lock.sh` with the protocol in [plan.md → Shared contracts](../plan.md#shared-contracts):

- `_lock_new_id`: prints `${HOSTNAME:-$(hostname)}:${BASHPID:-$$}:$(date +%s)-${RANDOM}${RANDOM}`.
- `_acquire_lock`: generate a fresh id, then loop:
  - attempt `( set -o noclobber; printf '%s\n' "$id" > "$LOCK_FILE" ) 2>/dev/null`; on success, remember the id (see the note on nesting in [scripter.md](../scripter.md#notes)) and `return 0`;
  - otherwise read the current holder (`$(cat "$LOCK_FILE" 2>/dev/null)`, trimmed by the command substitution). If it is parseable (3 `:`-separated parts, numeric pid), has our hostname, and the pid is dead (`kill -0`, then `ps -p` fallback for EPERM), re-read, `rm -f` only if unchanged, and `continue` without sleeping or counting an attempt;
  - otherwise `sleep "${ARCANUM_LOCK_RETRY_SLEEP:-1}"`, count the attempt, and keep the existing warn-once-every-10 logic and text.
  - If the file vanished between the failed create and the read (an empty read), just retry immediately.
- `_release_lock`: remove `$LOCK_FILE` only if its trimmed content equals the remembered id, then forget the id. Do nothing otherwise, and never error. It must be safe to call when nothing is held (`trap '_release_lock' EXIT` in `monitor_issues_shell.sh`).
- Update the header comment to describe the new protocol. Keep the file sourced-only, bash 3.2-compatible (no associative arrays if avoidable, no `BASHPID` dependency), and shellcheck-clean.

## Files to Change
- `arcanum/_lib/lock.sh` — new acquire/release/stale logic, id helper, retry-sleep override, updated header.
