# Shared helper: tracks per-entry completion of "instructions"-type
# per-repo migrations, so resuming a version whose manifest hands off to
# the AI never re-triggers an already-completed entry.
#
# This file is meant to be SOURCED, not executed directly. See
# ledger.sh for the executable CLI wrapper used by callers that can only
# invoke real executables (e.g. arcanum-migrate/SKILL.md, run as the
# architect).
#
# --- Ledger file schema ---
#
# .claude/state/arcanum-migrations-ledger.json — a flat array, one entry
# per completed "instructions" entry, never reset/overwritten wholesale
# (unlike .claude/state/arcanum-errors.json, which run.sh resets fresh
# on every invocation): the ledger only ever grows.
#
#   [
#     {"version": "0.13.0", "id": "002"},
#     {"version": "0.13.0", "id": "004"}
#   ]
#
# No "skippable"/"message" fields like the errors file — a ledger entry
# only ever means "done." Once a version's pointer advances past all its
# entries, its rows become dead weight but harmless:
# update_per_version.sh's existing pointer-based satisfied-check
# short-circuits before ever consulting the ledger for an
# already-pointer-satisfied version.
#
# Writers: only arcanum-migrate/SKILL.md ever calls
# _ledger_mark_complete (via ledger.sh mark-complete), once it finishes
# an instructions entry's work (autonomous hand-off, or a [C]hat outcome
# that ends up performing the work). The runner scripts
# (update_per_file.sh/update_per_version.sh) only ever hand off, and on
# resume only ever read the ledger — they have no visibility into
# whether the AI's work actually succeeded, so they never write to it.

# _ledger_is_complete <repo_path> <version> <id>
#   Exits 0 if the ledger already has an entry for <version>/<id>, 1
#   otherwise (including when the ledger file doesn't exist yet). No
#   lock needed — read-only.
_ledger_is_complete() {
  local repo_path="$1" version="$2" id="$3"
  local ledger_file="${repo_path}/.claude/state/arcanum-migrations-ledger.json"

  [[ -s "$ledger_file" ]] || return 1

  jq -e --arg version "$version" --arg id "$id" \
    'any(.[]; .version == $version and .id == $id)' \
    "$ledger_file" >/dev/null 2>&1
}

# _ledger_mark_complete <repo_path> <version> <id>
#   Lock-protected append into the ledger file, created on first write.
#   Deduplicates — a repeated mark-complete for the same <version>/<id>
#   is a no-op, not a duplicate row.
_ledger_mark_complete() {
  local repo_path="$1" version="$2" id="$3"
  local ledger_file="${repo_path}/.claude/state/arcanum-migrations-ledger.json"

  mkdir -p "$(dirname "$ledger_file")"
  LOCK_FILE="${ledger_file}.lock"
  _acquire_lock

  local current="[]"
  if [[ -s "$ledger_file" ]] && jq -e . "$ledger_file" >/dev/null 2>&1; then
    current="$(cat "$ledger_file")"
  fi

  jq --arg version "$version" --arg id "$id" \
    'if any(.[]; .version == $version and .id == $id)
     then .
     else . + [{version: $version, id: $id}]
     end' \
    <<<"$current" > "${ledger_file}.tmp"
  mv "${ledger_file}.tmp" "$ledger_file"

  _release_lock
}
