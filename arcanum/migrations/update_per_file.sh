#!/usr/bin/env bash
# Run (or offer to run) a single repo-side migration entry.
# Usage: update_per_file.sh <version> <file_path> [--no-confirm]
#                            [--skippable true|false] [--repo <path>]
#                            [--type script|instructions]
#                            [--instructions-file <path>] [--id <id>]
#
# --type defaults to "script", for backward compatibility with direct/
# legacy calls. --instructions-file and --id are required when --type
# instructions (ignored otherwise).
#
# --- type: script ---
#
# <file_path> is the path to a migration's NNN.sh file (already
# resolved by the caller, e.g. arcanum/migrations/repos/0.6.0/001.sh).
# Entirely unchanged from before this file's "instructions" support.
#
# --skippable <bool> is optional. update_per_version.sh (the only
# caller) always resolves it from the entry's manifest (or, for legacy
# glob-discovered entries, from a live "<file_path> config" call) via
# _manifest.sh before calling this script, and passes it straight
# through — so this script itself never has to know whether the entry
# it's running is manifest-driven or legacy. When --skippable is
# omitted (e.g. a direct, ad-hoc invocation), this script falls back to
# calling "<file_path> config" itself, same as before this file's
# manifest-aware rewrite.
#
# --repo <path> is optional, trailing (after the required positionals,
# in any order relative to the other flags), and defaults to "."
# (today's cwd-relative behavior, unchanged). When given, ERRORS_FILE
# resolves relative to it instead of cwd. The arcanum install location
# itself (SCRIPT_DIR, derived from BASH_SOURCE) is never affected by
# --repo — only target-repo-relative paths are.
#
# Every "script" migration file must implement this contract:
#   NNN.sh config   -> prints a JSON object to stdout, e.g.
#                       {"skippable": true}, and exits 0. Only actually
#                       called by this script when --skippable is
#                       omitted (legacy/ad-hoc path — see above); a
#                       manifest-driven entry's "skippable" already
#                       lives in migrations.json instead, so its own
#                       config subcommand becomes redundant (kept for
#                       backward compatibility, harmless either way).
#   NNN.sh run      -> performs the migration; exits 0 on success,
#                       nonzero on failure (failure message to stderr).
#                       Must be idempotent (safe to re-run) — a
#                       non-skippable failure means the same migration
#                       is retried on a later run, similar to
#                       conventional DB migration systems.
#
# Without --no-confirm: prints the paired NNN.md content (same basename
# as <file_path>, .sh replaced with .md) and prompts (via /dev/tty)
# [R]un/[S]kip/[C]hat. Before attempting the /dev/tty read, verifies
# /dev/tty is actually open/readable; if not, fails fast to stderr
# (exit 1) instead of blocking forever. [S] exits 0 without doing
# anything (no error recorded). [C]hat prints
# CHAT_CONTEXT=<version>/<file_basename> to stdout and exits 3 without
# running the migration.
#
# With --no-confirm, or after choosing [R]un above: runs
# "<file_path> run" (resolving skippable first, per --skippable above).
#
#   Success (exit 0)                 -> exits 0. Does NOT touch either
#                                        version pointer itself anymore
#                                        — update_per_version.sh owns
#                                        advancing them, once, after its
#                                        entire manifest for this
#                                        version completes without a
#                                        halt (the per-manifest, not
#                                        per-file, version-advance
#                                        fix).
#   Failure, skippable == true       -> records an error entry to
#                                        .claude/state/arcanum-errors.json.
#                                        Exits 0 (the migration declares
#                                        itself safe to consider done
#                                        even if it failed).
#   Failure, skippable == false      -> records the error and exits 2.
#                                        This exit code signals "halt"
#                                        to callers
#                                        (update_per_version.sh,
#                                        select_version.sh, run.sh),
#                                        which must propagate it
#                                        upward immediately rather than
#                                        continuing — and must skip
#                                        their own version-advance step
#                                        when this happens.
#
# --- type: instructions ---
#
# <file_path> is the entry's human-facing description .md, given
# directly (there is no ".sh" to derive it from) — printed at the
# confirm prompt exactly like a "script" entry's paired ".md", same UX.
# Never shells out to "<file> config"/"<file> run" — there's nothing to
# execute; a bash script cannot perform an instructions entry's work
# itself.
#
#   [R]un (or --no-confirm) -> prints AI_INSTRUCTIONS=<version>/<id> to
#                               stdout and exits 3 immediately. No
#                               attempt to run anything.
#   [S]kip                  -> exits 0, same as "script" (no ledger
#                               write — relies on the same "skip
#                               doesn't block version-advance"
#                               semantics "script" entries already
#                               have).
#   [C]hat                  -> prints CHAT_CONTEXT=<version>/<id> (using
#                               <id>, not a filename, since an
#                               instructions entry has two files) and
#                               exits 3.
#
# Exit code contract: 0 = success/skip, 2 = halt (non-skippable
# "script" failure), 3 = [C]hat requested or AI_INSTRUCTIONS hand-off
# (nothing run by this script either way).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../_lib/lock.sh
source "${SCRIPT_DIR}/../_lib/lock.sh"

USAGE="Usage: $0 <version> <file_path> [--no-confirm] [--skippable true|false] [--repo <path>] [--type script|instructions] [--instructions-file <path>] [--id <id>]"

VERSION="${1:?$USAGE}"
FILE_PATH="${2:?$USAGE}"
shift 2

NO_CONFIRM=false
REPO_PATH="."
SKIPPABLE=""
TYPE="script"
INSTRUCTIONS_FILE=""
ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-confirm)
      NO_CONFIRM=true
      shift
      ;;
    --skippable)
      SKIPPABLE="${2:?$USAGE}"
      shift 2
      ;;
    --repo)
      REPO_PATH="${2:?$USAGE}"
      shift 2
      ;;
    --type)
      TYPE="${2:?$USAGE}"
      shift 2
      ;;
    --instructions-file)
      INSTRUCTIONS_FILE="${2:?$USAGE}"
      shift 2
      ;;
    --id)
      ID="${2:?$USAGE}"
      shift 2
      ;;
    *)
      echo "$USAGE" >&2
      exit 1
      ;;
  esac
done

if [[ "$TYPE" == "instructions" ]]; then
  [[ -n "$INSTRUCTIONS_FILE" && -n "$ID" ]] || {
    echo "Error: --type instructions requires --instructions-file <path> and --id <id>." >&2
    exit 1
  }
  [[ -f "$INSTRUCTIONS_FILE" ]] || {
    echo "Error: instructions file '${INSTRUCTIONS_FILE}' not found." >&2
    exit 1
  }
fi

ERRORS_FILE="${REPO_PATH}/.claude/state/arcanum-errors.json"

if [[ "$TYPE" == "instructions" ]]; then
  if [[ "$NO_CONFIRM" != true ]]; then
    if [[ -f "$FILE_PATH" ]]; then
      cat "$FILE_PATH"
    fi
    if ! ( exec 3< /dev/tty ) 2>/dev/null; then
      echo "Error: no interactive terminal (/dev/tty) available to prompt for [R]un/[S]kip/[C]hat. Pass --no-confirm, or run this from a real terminal." >&2
      exit 1
    fi
    printf '[R]un/[S]kip/[C]hat: '
    read -r choice < /dev/tty
    case "$choice" in
      [Rr]*)
        echo "AI_INSTRUCTIONS=${VERSION}/${ID}"
        exit 3
        ;;
      [Cc]*)
        echo "CHAT_CONTEXT=${VERSION}/${ID}"
        exit 3
        ;;
      *) exit 0 ;;
    esac
  fi

  echo "AI_INSTRUCTIONS=${VERSION}/${ID}"
  exit 3
fi

if [[ "$NO_CONFIRM" != true ]]; then
  MD_PATH="${FILE_PATH%.sh}.md"
  if [[ -f "$MD_PATH" ]]; then
    cat "$MD_PATH"
  fi
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    echo "Error: no interactive terminal (/dev/tty) available to prompt for [R]un/[S]kip/[C]hat. Pass --no-confirm, or run this from a real terminal." >&2
    exit 1
  fi
  printf '[R]un/[S]kip/[C]hat: '
  read -r choice < /dev/tty
  case "$choice" in
    [Rr]*) ;;
    [Cc]*)
      echo "CHAT_CONTEXT=${VERSION}/$(basename "$FILE_PATH")"
      exit 3
      ;;
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

if [[ -z "$SKIPPABLE" ]]; then
  CONFIG_JSON="$("$FILE_PATH" config)"
  SKIPPABLE="$(jq -r '.skippable' <<<"$CONFIG_JSON")"
fi

STDERR_TMP="$(mktemp)"
trap 'rm -f "$STDERR_TMP"' EXIT

RC=0
"$FILE_PATH" run 2>"$STDERR_TMP" || RC=$?
STDERR_OUTPUT="$(cat "$STDERR_TMP")"
rm -f "$STDERR_TMP"
trap - EXIT

if [[ "$RC" -eq 0 ]]; then
  exit 0
fi

MESSAGE="$STDERR_OUTPUT"
[[ -n "$MESSAGE" ]] || MESSAGE="Migration failed with exit code ${RC} and no error output."

if [[ "$SKIPPABLE" == "true" ]]; then
  _record_error "true" "$MESSAGE"
  exit 0
else
  _record_error "false" "$MESSAGE"
  exit 2
fi
