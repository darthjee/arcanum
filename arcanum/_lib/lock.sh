# shellcheck shell=bash
# Shared lock helpers for scripts that mutate shared JSON state files.
#
# Usage: source this file, then call _acquire_lock / _release_lock around
# the mutation. The caller must set LOCK_FILE before sourcing (or before
# calling _acquire_lock).
#
# Protocol (shared byte-for-byte with core/lib/shared/file/Lock.js, so
# shell and native writers exclude each other on the same lock file):
#   - Instance id: <hostname>:<pid>:<nonce>, generated fresh per
#     _acquire_lock call. The lock file holds the id followed by "\n".
#   - Acquire: atomic create-if-absent (noclobber). Success means the
#     lock is held at once, no sleep. If the file already exists, check
#     whether it is stale, then sleep ${ARCANUM_LOCK_RETRY_SLEEP:-1}s and
#     retry. Never gives up; warns once per acquisition after 10 failed
#     attempts.
#   - Stale: only a parseable id (exactly 3 ":"-separated parts, numeric
#     pid) with our hostname and a dead pid. Anything else (old-protocol
#     ids, empty or hand-written content) is never stale. A stale lock is
#     re-read right before removal and removed only if unchanged, then
#     the create is retried immediately. The small race between that
#     re-read and the remove is accepted.
#   - Release: remove the file only if it still holds this holder's id;
#     otherwise do nothing. Safe to call when nothing is held (e.g. from
#     an EXIT trap).
#
# Held ids are tracked per lock path, so nested acquisition of different
# lock files in one shell works. Bash 3.2-compatible (no associative
# arrays; BASHPID optional).
#
# This file is meant to be SOURCED, not executed directly.

# Parallel arrays: _LOCK_HELD_PATHS[i] is held with id _LOCK_HELD_IDS[i].
if [[ -z "${_LOCK_HELD_PATHS+x}" ]]; then
  _LOCK_HELD_PATHS=()
  _LOCK_HELD_IDS=()
fi

# _lock_hostname
#   Prints this host's name, as used in instance ids.
_lock_hostname() {
  printf '%s\n' "${HOSTNAME:-$(hostname)}"
}

# _lock_new_id [<pid>]
#   Prints a fresh instance id <hostname>:<pid>:<nonce>. <pid> defaults to
#   ${BASHPID:-$$}; callers using command substitution must pass their own
#   pid, since the substitution runs in a short-lived subshell.
_lock_new_id() {
  local pid="${1:-${BASHPID:-$$}}"
  printf '%s:%s:%s-%s%s\n' "$(_lock_hostname)" "$pid" "$(date +%s)" "$RANDOM" "$RANDOM"
}

# _lock_pid_alive <pid>
#   Exits 0 if <pid> is alive (including another user's process), 1 if dead.
_lock_pid_alive() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null && return 0
  ps -p "$pid" >/dev/null 2>&1 && return 0
  return 1
}

# _lock_trim <text>
#   Prints <text> with leading/trailing whitespace removed.
_lock_trim() {
  local text="$1"
  text="${text#"${text%%[![:space:]]*}"}"
  text="${text%"${text##*[![:space:]]}"}"
  printf '%s\n' "$text"
}

# _lock_read <path>
#   Prints the trimmed content of <path>, or nothing if it is unreadable.
_lock_read() {
  local content
  content="$(cat "$1" 2>/dev/null)" || content=""
  _lock_trim "$content"
}

# _lock_is_stale <holder_id>
#   Exits 0 only if <holder_id> is parseable (exactly 3 ":"-separated
#   parts, numeric pid), has our hostname, and its pid is dead.
_lock_is_stale() {
  local holder="$1"
  local colons="${holder//[^:]/}"
  [[ ${#colons} -eq 2 ]] || return 1
  local host="${holder%%:*}"
  local rest="${holder#*:}"
  local pid="${rest%%:*}"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [[ "$host" == "$(_lock_hostname)" ]] || return 1
  _lock_pid_alive "$pid" && return 1
  return 0
}

# _lock_remember <path> <id>
_lock_remember() {
  _LOCK_HELD_PATHS[${#_LOCK_HELD_PATHS[@]}]="$1"
  _LOCK_HELD_IDS[${#_LOCK_HELD_IDS[@]}]="$2"
}

# _lock_held_index <path>
#   Prints the index of <path> in the held list; exits 1 if not held.
_lock_held_index() {
  local i=0
  local n=${#_LOCK_HELD_PATHS[@]}
  while (( i < n )); do
    if [[ "${_LOCK_HELD_PATHS[i]}" == "$1" ]]; then
      printf '%s\n' "$i"
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# _lock_forget <index>
_lock_forget() {
  local idx="$1"
  local i=0
  local n=${#_LOCK_HELD_PATHS[@]}
  local paths=() ids=()
  while (( i < n )); do
    if (( i != idx )); then
      paths[${#paths[@]}]="${_LOCK_HELD_PATHS[i]}"
      ids[${#ids[@]}]="${_LOCK_HELD_IDS[i]}"
    fi
    i=$((i + 1))
  done
  _LOCK_HELD_PATHS=()
  _LOCK_HELD_IDS=()
  i=0
  n=${#paths[@]}
  while (( i < n )); do
    _LOCK_HELD_PATHS[i]="${paths[i]}"
    _LOCK_HELD_IDS[i]="${ids[i]}"
    i=$((i + 1))
  done
}

_acquire_lock() {
  local instance_id holder again
  # Resolve the pid here, in the calling shell: expanding BASHPID inside
  # the command substitution below would capture the short-lived
  # substitution subshell's pid, which others would then see as dead.
  local holder_pid="${BASHPID:-$$}"
  instance_id="$(_lock_new_id "$holder_pid")"
  local attempt=0
  local warned=false
  while true; do
    if ( set -o noclobber; printf '%s\n' "$instance_id" > "$LOCK_FILE" ) 2>/dev/null; then
      _lock_remember "$LOCK_FILE" "$instance_id"
      return 0
    fi
    holder="$(_lock_read "$LOCK_FILE")"
    if [[ -z "$holder" && ! -e "$LOCK_FILE" ]]; then
      # Vanished between the failed create and the read: retry at once.
      continue
    fi
    if _lock_is_stale "$holder"; then
      again="$(_lock_read "$LOCK_FILE")"
      if [[ "$again" == "$holder" ]]; then
        rm -f "$LOCK_FILE"
      fi
      continue
    fi
    sleep "${ARCANUM_LOCK_RETRY_SLEEP:-1}"
    attempt=$((attempt + 1))
    if (( attempt % 10 == 0 )); then
      if [[ "$warned" == false ]]; then
        echo "Warning: lock ($LOCK_FILE) seems stuck after ${attempt} attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying..." >&2
        warned=true
      fi
      attempt=0
    fi
  done
}

_release_lock() {
  local idx current
  idx="$(_lock_held_index "${LOCK_FILE:-}")" || return 0
  current="$(_lock_read "$LOCK_FILE")"
  if [[ "$current" == "${_LOCK_HELD_IDS[idx]}" ]]; then
    rm -f "$LOCK_FILE"
  fi
  _lock_forget "$idx"
  return 0
}
