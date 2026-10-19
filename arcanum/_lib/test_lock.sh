#!/usr/bin/env bash
# Standalone coverage for arcanum/_lib/lock.sh — the shared lock protocol
# (issue #807: atomic create, owner-checked release, same-host dead-pid
# stale detection; see docs/agents/plans/807-.../plan.md's "Shared
# contracts").
#
# Usage: bash arcanum/_lib/test_lock.sh  (no arguments)
# Standalone — not wired into any skill's flow, same convention as
# arcanum/_lib/test_origin_resolution.sh. Exit 0 on success, non-zero
# with a message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lock.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lock.sh"

export ARCANUM_LOCK_RETRY_SLEEP=0.05

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

TMP_DIR=""
BG_PIDS=()
# shellcheck disable=SC2329  # invoked via trap
cleanup() {
  local i=0
  while (( i < ${#BG_PIDS[@]} )); do
    kill "${BG_PIDS[i]}" 2>/dev/null
    i=$((i + 1))
  done
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TMP_DIR="$(mktemp -d)"
HOST="${HOSTNAME:-$(hostname)}"

# _wait_for <path> — waits up to ~5s for <path> to exist.
_wait_for() {
  local i=0
  while (( i < 100 )); do
    [[ -e "$1" ]] && return 0
    sleep 0.05
    i=$((i + 1))
  done
  return 1
}

# _bg_acquire <lock_file> <marker> — acquires <lock_file> in the
# background and touches <marker> once held. Sets BG_PID.
BG_PID=""
_bg_acquire() {
  ( LOCK_FILE="$1"; _acquire_lock; : > "$2"; sleep 30 ) &
  BG_PID=$!
  BG_PIDS[${#BG_PIDS[@]}]="$BG_PID"
}

# --- 1. Acquire on an absent file is immediate; release removes it ---
LOCK_FILE="${TMP_DIR}/one.lock"
start=$SECONDS
ARCANUM_LOCK_RETRY_SLEEP=5 _acquire_lock
(( SECONDS - start < 2 )) || fail "case 1: acquire on an absent file was not immediate"
content="$(cat "$LOCK_FILE")"
[[ "$content" =~ ^[^:]+:[0-9]+:[^:[:space:]]+$ ]] || fail "case 1: unexpected id format: $content"
[[ "${content%%:*}" == "$HOST" ]] || fail "case 1: id hostname is not ours: $content"
_release_lock
[[ ! -e "$LOCK_FILE" ]] || fail "case 1: release did not remove the lock file"

# --- 2. A foreign live lock blocks until it is removed ---
LOCK_FILE="${TMP_DIR}/two.lock"
printf '%s\n' "${HOST}:$$:x" > "$LOCK_FILE"
_bg_acquire "$LOCK_FILE" "${TMP_DIR}/two.acquired"
sleep 0.3
[[ ! -e "${TMP_DIR}/two.acquired" ]] || fail "case 2: acquired while a live foreign lock was held"
rm -f "$LOCK_FILE"
_wait_for "${TMP_DIR}/two.acquired" || fail "case 2: did not acquire after the foreign lock was removed"
[[ "$(cat "$LOCK_FILE")" != "${HOST}:$$:x" ]] || fail "case 2: lock file does not hold the new holder's id"
kill "$BG_PID" 2>/dev/null
wait "$BG_PID" 2>/dev/null

# --- 3. Owner-checked release leaves a foreign lock alone ---
LOCK_FILE="${TMP_DIR}/three.lock"
_acquire_lock
printf '%s\n' "other-host:1:y" > "$LOCK_FILE"
_release_lock
[[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "other-host:1:y" ]] || fail "case 3: release removed a foreign lock"

# --- 4. Release with nothing held is a no-op ---
LOCK_FILE="${TMP_DIR}/four.lock"
printf '%s\n' "other-host:1:z" > "$LOCK_FILE"
_release_lock || fail "case 4: release with nothing held returned non-zero"
[[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "other-host:1:z" ]] || fail "case 4: release with nothing held touched the lock file"

# --- 5. A same-host dead-pid lock is broken ---
LOCK_FILE="${TMP_DIR}/five.lock"
sleep 0 &
dead_pid=$!
wait "$dead_pid"
printf '%s\n' "${HOST}:${dead_pid}:x" > "$LOCK_FILE"
start=$SECONDS
_acquire_lock
(( SECONDS - start < 2 )) || fail "case 5: breaking a stale lock was not immediate"
content="$(cat "$LOCK_FILE")"
[[ "$content" != "${HOST}:${dead_pid}:x" && "${content%%:*}" == "$HOST" ]] \
  || fail "case 5: stale lock was not replaced by our id: $content"
_release_lock
[[ ! -e "$LOCK_FILE" ]] || fail "case 5: release did not remove the lock file"

# --- 6. Cross-host and old-format ids are never broken ---
for foreign in "some-other-host:1:x" "host-123-456"; do
  LOCK_FILE="${TMP_DIR}/six.lock"
  rm -f "$LOCK_FILE" "${TMP_DIR}/six.acquired"
  printf '%s\n' "$foreign" > "$LOCK_FILE"
  _bg_acquire "$LOCK_FILE" "${TMP_DIR}/six.acquired"
  sleep 0.3
  [[ ! -e "${TMP_DIR}/six.acquired" ]] || fail "case 6: broke a never-stale lock ($foreign)"
  kill -0 "$BG_PID" 2>/dev/null || fail "case 6: background acquire exited ($foreign)"
  [[ "$(cat "$LOCK_FILE")" == "$foreign" ]] || fail "case 6: lock file changed ($foreign)"
  kill "$BG_PID" 2>/dev/null
  wait "$BG_PID" 2>/dev/null
done

# --- 7. Mutual exclusion: no lost updates ---
LOCK_FILE="${TMP_DIR}/seven.lock"
COUNTER="${TMP_DIR}/counter"
echo 0 > "$COUNTER"
WORKERS=5
ROUNDS=8
worker_pids=()
w=0
while (( w < WORKERS )); do
  (
    r=0
    while (( r < ROUNDS )); do
      _acquire_lock
      n="$(cat "$COUNTER")"
      sleep 0.01
      echo $((n + 1)) > "$COUNTER"
      _release_lock
      r=$((r + 1))
    done
  ) 2>>"${TMP_DIR}/seven.stderr" &
  worker_pids[${#worker_pids[@]}]=$!
  w=$((w + 1))
done
for p in "${worker_pids[@]}"; do
  wait "$p" || fail "case 7: a worker failed"
done
total="$(cat "$COUNTER")"
[[ "$total" == $((WORKERS * ROUNDS)) ]] || fail "case 7: lost update (counter=${total}, expected $((WORKERS * ROUNDS)))"
[[ ! -e "$LOCK_FILE" ]] || fail "case 7: lock file left behind"

echo "OK: lock.sh tests passed"
exit 0
