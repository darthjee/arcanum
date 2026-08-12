#!/usr/bin/env bash
# Run (or offer to run) a single repo-side migration file.
# Usage: update_per_file.sh <version> <file_path> [--no-confirm]
#
# <file_path> is the path to a migration's NNN.sh file (already
# resolved by the caller, e.g. arcanum/migrations/repos/0.6.0/001.sh).
#
# Every migration file must implement this contract:
#   NNN.sh config   -> prints a JSON object to stdout, e.g.
#                       {"skippable": true}, and exits 0.
#   NNN.sh run      -> performs the migration; exits 0 on success,
#                       nonzero on failure (failure message to stderr).
#                       Must be idempotent (safe to re-run) — a
#                       non-skippable failure means the same migration
#                       is retried on a later run, similar to
#                       conventional DB migration systems.
#
# Without --no-confirm: prints the paired NNN.md content (same basename
# as <file_path>, .sh replaced with .md) and prompts (via /dev/tty)
# [R]un/[S]kip. [S] exits 0 without doing anything (no error recorded,
# no version change).
#
# With --no-confirm, or after choosing [R]un above: calls
# "<file_path> config" for {"skippable": ...}, then "<file_path> run".
#
#   Success (exit 0)                 -> advances the recorded version
#                                        in
#                                        .claude/configuration/arcanum-repo-config.json
#                                        to <version>. Exits 0.
#   Failure, skippable == true       -> records an error entry to
#                                        .claude/state/arcanum-errors.json,
#                                        THEN still advances the version
#                                        (the migration declares itself
#                                        safe to consider done even if
#                                        it failed). Exits 0.
#   Failure, skippable == false      -> records the error, does NOT
#                                        advance the version, and exits
#                                        2. This exit code signals
#                                        "halt" to callers
#                                        (update_per_version.sh,
#                                        select_version.sh, run.sh),
#                                        which must propagate it
#                                        upward immediately rather than
#                                        continuing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
ERRORS_FILE=".claude/state/arcanum-errors.json"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=../_lib/lock.sh
source "${SCRIPT_DIR}/../_lib/lock.sh"

VERSION="${1:?Usage: $0 <version> <file_path> [--no-confirm]}"
FILE_PATH="${2:?Usage: $0 <version> <file_path> [--no-confirm]}"
NO_CONFIRM=false
[[ "${3:-}" == "--no-confirm" ]] && NO_CONFIRM=true

if [[ "$NO_CONFIRM" != true ]]; then
  MD_PATH="${FILE_PATH%.sh}.md"
  if [[ -f "$MD_PATH" ]]; then
    cat "$MD_PATH"
  fi
  printf '[R]un/[S]kip: '
  read -r choice < /dev/tty
  case "$choice" in
    [Rr]*) ;;
    *) exit 0 ;;
  esac
fi

# _record_error <skippable_json> <message>
#   Appends (doesn't overwrite) an error entry to $ERRORS_FILE, lock-
#   protected via arcanum/_lib/lock.sh (a dedicated lock file, not
#   routed through repo_config.sh since this file isn't namespaced
#   config).
_record_error() {
  local skippable="$1" message="$2"
  local base
  base="$(basename "$FILE_PATH")"

  mkdir -p "$(dirname "$ERRORS_FILE")"
  LOCK_FILE="${ERRORS_FILE}.lock"
  _acquire_lock

  local current="[]"
  if [[ -s "$ERRORS_FILE" ]] && jq -e . "$ERRORS_FILE" >/dev/null 2>&1; then
    current="$(cat "$ERRORS_FILE")"
  fi

  jq --arg version "$VERSION" --arg file "$base" --argjson skippable "$skippable" --arg message "$message" \
    '. + [{version: $version, file: $file, skippable: $skippable, message: $message}]' \
    <<<"$current" > "${ERRORS_FILE}.tmp"
  mv "${ERRORS_FILE}.tmp" "$ERRORS_FILE"

  _release_lock
}

CONFIG_JSON="$("$FILE_PATH" config)"
SKIPPABLE="$(jq -r '.skippable' <<<"$CONFIG_JSON")"

STDERR_TMP="$(mktemp)"
trap 'rm -f "$STDERR_TMP"' EXIT

RC=0
"$FILE_PATH" run 2>"$STDERR_TMP" || RC=$?
STDERR_OUTPUT="$(cat "$STDERR_TMP")"
rm -f "$STDERR_TMP"
trap - EXIT

if [[ "$RC" -eq 0 ]]; then
  repo_config_set_version "$CONFIG_FILE" "$VERSION"
  exit 0
fi

MESSAGE="$STDERR_OUTPUT"
[[ -n "$MESSAGE" ]] || MESSAGE="Migration failed with exit code ${RC} and no error output."

if [[ "$SKIPPABLE" == "true" ]]; then
  _record_error "true" "$MESSAGE"
  repo_config_set_version "$CONFIG_FILE" "$VERSION"
  exit 0
else
  _record_error "false" "$MESSAGE"
  exit 2
fi
