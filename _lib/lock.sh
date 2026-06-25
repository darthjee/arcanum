# Shared lock helpers for scripts that mutate shared JSON state files.
#
# Usage: source this file, then call _acquire_lock / _release_lock around
# the mutation. The caller must set LOCK_FILE before sourcing (or before
# calling _acquire_lock). Never give up — retries indefinitely; warns once
# per acquisition after 10 failed attempts.
#
# This file is meant to be SOURCED, not executed directly.

_acquire_lock() {
  local instance_id="${HOSTNAME:-host}-$$-$(date +%s%N)"
  local attempt=0
  local warned=false
  while true; do
    attempt=$((attempt + 1))
    echo "$instance_id" > "$LOCK_FILE"
    sleep 1
    if [[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "$instance_id" ]]; then
      return 0
    fi
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
  rm -f "$LOCK_FILE"
}
