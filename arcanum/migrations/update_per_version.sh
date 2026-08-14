#!/usr/bin/env bash
# Run (or offer to run) every still-pending migration entry for a
# single version, per its manifest (migrations.json, or legacy glob
# discovery when absent — see _manifest.sh).
# Usage: update_per_version.sh <version> [--no-confirm] [--repo <path>]
#
# --repo <path> is optional, trailing (after <version>, in any order
# relative to --no-confirm), and defaults to "." (today's cwd-relative
# behavior, unchanged). Forwarded verbatim into every
# update_per_file.sh call this script makes, and used to resolve both
# the committed and local-only version pointers (see below). The
# arcanum install location itself (SCRIPT_DIR, derived from
# BASH_SOURCE) is never affected by --repo.
#
# Reads arcanum/migrations/repos/<version>/'s manifest entries (id,
# type, primary_file, instructions_file, skippable, applies_to — see
# _manifest.sh) in order. Entries already satisfied by the relevant
# pointer — a "repo" entry when the committed version already reaches
# <version>, or a "local" entry when the local version already does —
# are silently skipped, not even shown, same as a fully-passed version
# isn't shown today. A "type": "instructions" entry is also considered
# satisfied, regardless of pointer position, once
# .claude/state/arcanum-migrations-ledger.json (see _ledger.sh) has
# recorded it complete — this is what makes resume-without-replay work:
# a second pass through a still-pending version skips entries the
# ledger already marked done and continues from the first
# not-yet-completed one, instead of re-triggering the AI hand-off for
# an already-handled entry. Only the remaining ("to-run") entries are
# listed/executed below.
#
# For a "type": "script" entry, calling update_per_file.sh is exactly
# as before this file's "instructions" support: <primary_file> (its
# "file") positionally, plus --skippable <bool> --repo <path>. For a
# "type": "instructions" entry, <primary_file> (its "description_file")
# is passed the same way, plus --type instructions
# --instructions-file <version_dir>/<instructions_file> --id <id> — see
# _run_entry below. update_per_file.sh unconditionally hands off (exit
# 3, AI_INSTRUCTIONS=<version>/<id>) on [R]un/--no-confirm for these,
# which propagates up exactly like a [C]hat request already does.
#
# With --no-confirm: runs update_per_file.sh (via _run_entry) with
# --no-confirm for each to-run entry in order; if any call exits 2
# (halt), stops immediately and exits 2 without running the remaining
# entries (the version-advance step below is skipped too, since it
# never runs on a halt).
#
# Without --no-confirm: prints the to-run entries' file basenames,
# verifies /dev/tty is actually open/readable (failing fast to
# stderr, exit 1, if not), then prompts (via /dev/tty)
# [A]ll/[N]one/[S]elect/[C]hat:
#   [A]ll     -> same as the --no-confirm loop above (stop + exit 2 on
#                first halt, or exit 3 immediately if an entry requests
#                [C]hat or hands off via AI_INSTRUCTIONS).
#   [N]one    -> exits 0, nothing runs, no pointer is advanced.
#   [S]elect  -> for each to-run entry in order, calls update_per_file.sh
#                (via _run_entry, no --no-confirm, so it does its own
#                [R]un/[S]kip/[C]hat prompt per entry); if any call
#                exits 2, stops immediately and exits 2; if any call
#                exits 3 ([C]hat or AI_INSTRUCTIONS), stops immediately
#                and exits 3.
#   [C]hat    -> prints CHAT_CONTEXT=<version> and exits 3 immediately
#                (no entry has been touched yet at this point).
#
# All-entries-processed-without-halt-or-chat (via --no-confirm, [A]ll,
# or [S]elect): this version's manifest is now considered fully
# processed, so the relevant pointer(s) advance — the committed one to
# <version> if the manifest has any "repo"-scoped entry (and it isn't
# already there), the local one to <version> if it has any
# "local"-scoped entry (and it isn't already there). This is the
# per-manifest (not per-file) version-advance fix: mid-version progress
# lives in the errors file, not in an early, partial pointer bump. A
# user-chosen [S]kip on an individual entry does not block this — it's
# a deliberate "not applying this one" choice, not a halt.
#
# Exit code contract: 0 = completed (or nothing to do / [N]one chosen),
# 2 = halt (propagated from update_per_file.sh), 3 = [C]hat requested
# (either at this level, or propagated from update_per_file.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_PER_FILE="${SCRIPT_DIR}/update_per_file.sh"
MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=_manifest.sh
source "${SCRIPT_DIR}/_manifest.sh"
# shellcheck source=_pending_versions.sh
source "${SCRIPT_DIR}/_pending_versions.sh"
# shellcheck source=_ledger.sh
source "${SCRIPT_DIR}/_ledger.sh"

USAGE="Usage: $0 <version> [--no-confirm] [--repo <path>]"

VERSION="${1:?$USAGE}"
shift

NO_CONFIRM=false
REPO_PATH="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-confirm)
      NO_CONFIRM=true
      shift
      ;;
    --repo)
      REPO_PATH="${2:?$USAGE}"
      shift 2
      ;;
    *)
      echo "$USAGE" >&2
      exit 1
      ;;
  esac
done

VERSION_DIR="${SCRIPT_DIR}/repos/${VERSION}"
CONFIG_FILE="${REPO_PATH}/.claude/configuration/arcanum-repo-config.json"
LOCAL_CONFIG_FILE="${REPO_PATH}/.claude/state/arcanum-config.json"

COMMITTED="$(repo_config_get_version "$CONFIG_FILE")"
COMMITTED="${COMMITTED:-0.0.0}"
LOCAL_VERSION="$(repo_config_get_version "$LOCAL_CONFIG_FILE" migrations)"
LOCAL_VERSION="${LOCAL_VERSION:-0.0.0}"

HAS_REPO_ENTRY=false
HAS_LOCAL_ENTRY=false
ENTRY_ID=() ENTRY_TYPE=() ENTRY_FILE=() ENTRY_INSTRUCTIONS_FILE=() ENTRY_SKIPPABLE=() ENTRY_SCOPE=()

if [[ -d "$VERSION_DIR" ]]; then
  while IFS=$'\t' read -r id type primary_file instructions_file skippable applies_to; do
    [[ -n "$id" ]] || continue
    [[ "$applies_to" == "repo" ]] && HAS_REPO_ENTRY=true
    [[ "$applies_to" == "local" ]] && HAS_LOCAL_ENTRY=true

    satisfied=false
    if [[ "$applies_to" == "repo" ]] && ! _version_gt "$VERSION" "$COMMITTED"; then
      satisfied=true
    elif [[ "$applies_to" == "local" ]] && ! _version_gt "$VERSION" "$LOCAL_VERSION"; then
      satisfied=true
    elif [[ "$type" == "instructions" ]] && _ledger_is_complete "$REPO_PATH" "$VERSION" "$id"; then
      satisfied=true
    fi
    [[ "$satisfied" == true ]] && continue

    ENTRY_ID+=("$id")
    ENTRY_TYPE+=("$type")
    ENTRY_FILE+=("$primary_file")
    ENTRY_INSTRUCTIONS_FILE+=("$instructions_file")
    ENTRY_SKIPPABLE+=("$skippable")
    ENTRY_SCOPE+=("$applies_to")
  done < <(_manifest_entries "$VERSION_DIR")
fi

# _advance_pointers
#   Called once every to-run entry has been processed without halting
#   or a chat detour. Advances whichever pointer(s) this version's full
#   manifest actually has entries for, guarding against ever moving a
#   pointer backwards.
_advance_pointers() {
  if [[ "$HAS_REPO_ENTRY" == true ]]; then
    local cur
    cur="$(repo_config_get_version "$CONFIG_FILE")"
    cur="${cur:-0.0.0}"
    if _version_gt "$VERSION" "$cur"; then
      repo_config_set_version "$CONFIG_FILE" "$VERSION"
    fi
  fi
  if [[ "$HAS_LOCAL_ENTRY" == true ]]; then
    local cur
    cur="$(repo_config_get_version "$LOCAL_CONFIG_FILE" migrations)"
    cur="${cur:-0.0.0}"
    if _version_gt "$VERSION" "$cur"; then
      repo_config_set_version "$LOCAL_CONFIG_FILE" "$VERSION" migrations
    fi
  fi
}

# _run_entry <index> [--no-confirm]
#   Calls update_per_file.sh for entry <index>, dispatching on its type:
#   for "script", exactly as before this file's "instructions" support;
#   for "instructions", passes --type instructions
#   --instructions-file <version_dir>/<instructions_file> --id <id>
#   with the description file as the positional <file_path>.
_run_entry() {
  local i="$1"
  shift
  if [[ "${ENTRY_TYPE[$i]}" == "instructions" ]]; then
    "$UPDATE_PER_FILE" "$VERSION" "${VERSION_DIR}/${ENTRY_FILE[$i]}" "$@" \
      --skippable "${ENTRY_SKIPPABLE[$i]}" --repo "$REPO_PATH" \
      --type instructions --instructions-file "${VERSION_DIR}/${ENTRY_INSTRUCTIONS_FILE[$i]}" \
      --id "${ENTRY_ID[$i]}"
  else
    "$UPDATE_PER_FILE" "$VERSION" "${VERSION_DIR}/${ENTRY_FILE[$i]}" "$@" \
      --skippable "${ENTRY_SKIPPABLE[$i]}" --repo "$REPO_PATH"
  fi
}

if [[ "$NO_CONFIRM" == true ]]; then
  for i in "${!ENTRY_FILE[@]}"; do
    rc=0
    _run_entry "$i" --no-confirm || rc=$?
    [[ "$rc" -eq 2 ]] && exit 2
    [[ "$rc" -eq 3 ]] && exit 3
  done
  _advance_pointers
  exit 0
fi

if [[ ${#ENTRY_FILE[@]} -eq 0 ]]; then
  echo "No pending migrations for version ${VERSION}."
  exit 0
fi

echo "Migrations for version ${VERSION}:"
for f in "${ENTRY_FILE[@]}"; do
  echo "  $f"
done

if ! ( exec 3< /dev/tty ) 2>/dev/null; then
  echo "Error: no interactive terminal (/dev/tty) available to prompt for [A]ll/[N]one/[S]elect/[C]hat. Pass --no-confirm, or run this from a real terminal." >&2
  exit 1
fi
printf '[A]ll/[N]one/[S]elect/[C]hat: '
read -r choice < /dev/tty

case "$choice" in
  [Aa]*)
    for i in "${!ENTRY_FILE[@]}"; do
      rc=0
      _run_entry "$i" --no-confirm || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      [[ "$rc" -eq 3 ]] && exit 3
    done
    _advance_pointers
    ;;
  [Ss]*)
    for i in "${!ENTRY_FILE[@]}"; do
      rc=0
      _run_entry "$i" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      [[ "$rc" -eq 3 ]] && exit 3
    done
    _advance_pointers
    ;;
  [Cc]*)
    echo "CHAT_CONTEXT=${VERSION}"
    exit 3
    ;;
  *)
    exit 0
    ;;
esac

exit 0
