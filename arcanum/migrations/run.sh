#!/usr/bin/env bash
# Top-level per-repo migration runner entry point.
# Usage: run.sh [--repo <path>]
#        run.sh [--repo <path>] check
#        run.sh [--repo <path>] apply --all|--none|--select <version>
#
# --repo <path> is optional and may appear anywhere in the argument
# list (it's extracted before subcommand dispatch, so `run.sh --repo
# <path>`, `run.sh --repo <path> check`, and
# `run.sh apply --all --repo <path>` are all equivalent ways to pass
# it). Defaults to "." (today's cwd-relative behavior, unchanged, for
# backward-compatible direct terminal use). When given, it is
# validated (must exist and be a directory — a bad/malicious path
# fails fast with a clear error to stderr, exit 1, rather than
# silently misbehaving), then CONFIG_FILE/ERRORS_FILE resolve relative
# to it instead of cwd, and it is forwarded verbatim into every
# update_per_version.sh/select_version.sh call this script makes. The
# arcanum install location itself (SCRIPT_DIR, derived from
# BASH_SOURCE) is never affected by --repo — it always self-derives
# from wherever this script is physically installed.
#
# Reads two version pointers: the committed one, from the top-level
# .version field in .claude/configuration/arcanum-repo-config.json, and
# the local-only one, from .claude/state/arcanum-config.json's
# .migrations.version. If either is absent, it's treated as 0.0.0 and
# warned about (all migrations gated by that axis will run — see
# docs/guides/arcanum-repo-version.md). If either is present but not
# valid semver (X.Y.Z), hard-errors rather than guessing.
#
# Pending versions are the folders under arcanum/migrations/repos/
# whose manifest (migrations.json, or legacy glob discovery when
# absent) has at least one "repo"-scoped entry beyond the committed
# version, or at least one "local"-scoped entry beyond the local
# version — compared numerically field-by-field (not lexicographically
# — e.g. 0.10.0 > 0.9.0), sorted ascending. See _pending_versions.sh
# and _manifest.sh for the exact dual-pointer/scope gating.
#
# --- Form 1: `run.sh` (no subcommand) --- fully interactive, direct
# terminal use. Prints the current version and pending list, verifies
# /dev/tty is actually open/readable (failing fast to stderr, exit 1,
# if not), then prompts (/dev/tty) [A]ll/[N]one/[S]elect/[C]hat:
#   [A]ll     -> loops pending versions ascending, calling
#                update_per_version.sh <version> --no-confirm for each;
#                stops immediately if one exits 2 (halt).
#   [N]one    -> exits 0, untouched.
#   [S]elect  -> delegates to select_version.sh.
#   [C]hat    -> prints CHAT_CONTEXT= (empty — nothing selected yet)
#                and exits 3 immediately.
# If [A]ll or [S]elect propagates exit 3 ([C]hat requested deeper in
# the chain), it is re-propagated immediately (exit 3) instead of
# falling through to the error dump.
# If no pending versions: prints "Up to date (version <current>)." and
# exits 0 without touching the errors file.
#
# --- Form 2: `run.sh check` --- non-interactive, for skill-mediated
# use. Only prints, never prompts/runs/touches the errors file:
#   Invalid semver -> error to stderr, exit 1.
#   Else           -> "CURRENT=<version>" then either
#                      "STATUS=up_to_date" or one "PENDING=<version>"
#                      line per pending version (ascending). Exit 0.
#
# --- Form 3: `run.sh apply --all|--none|--select <version>` ---
# non-interactive execution, for skill-mediated use once the skill has
# already gotten the user's choice in chat:
#   --all              -> same as the interactive [A]ll path.
#   --none             -> no-op, exit 0.
#   --select <version> -> update_per_version.sh <version> --no-confirm
#                         (single version, no further prompting).
#
# Right before doing anything that could run a migration (forms 1 and
# 3, as soon as the pending list is known non-empty / --all or
# --select is chosen), .claude/state/arcanum-errors.json is reset to []
# (overwrite, lock-protected), once per invocation. At the end, its
# contents are printed if non-empty. Exit code contract for forms 1 and
# 3: 0 if the run completed without halting (even with skippable
# errors recorded), 1 if a halt (exit-2 propagation) occurred anywhere
# in the chain or on a usage/no-TTY/invalid-path error, 3 if [C]hat was
# chosen at any level in the chain (propagated verbatim, unlike halt —
# see CHAT_CONTEXT=<version>[/<file>] in the captured stdout).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=../_lib/lock.sh
source "${SCRIPT_DIR}/../_lib/lock.sh"
# shellcheck source=_pending_versions.sh
source "${SCRIPT_DIR}/_pending_versions.sh"

# Extract an optional --repo <path> from anywhere in the argument
# list, leaving the rest (subcommand + its own args) untouched in "$@".
REPO_PATH="."
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_PATH="${2:?Usage: $0 [--repo <path>] [check|apply --all|--none|--select <version>]}"
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

if [[ ! -d "$REPO_PATH" ]]; then
  echo "Error: --repo path '${REPO_PATH}' does not exist or is not a directory." >&2
  exit 1
fi

CONFIG_FILE="${REPO_PATH}/.claude/configuration/arcanum-repo-config.json"
LOCAL_CONFIG_FILE="${REPO_PATH}/.claude/state/arcanum-config.json"
ERRORS_FILE="${REPO_PATH}/.claude/state/arcanum-errors.json"

# _resolve_current_version
#   Prints the resolved committed version (0.0.0 + stderr warning if
#   absent) on stdout and returns 0, or prints an error to stderr and
#   returns 1 if the recorded version isn't valid semver.
_resolve_current_version() {
  local v
  v="$(repo_config_get_version "$CONFIG_FILE")"
  if [[ -z "$v" ]]; then
    echo "Warning: no version found in ${CONFIG_FILE} — treating as 0.0.0, all migrations will run. See docs/guides/arcanum-repo-version.md." >&2
    echo "0.0.0"
    return 0
  fi
  if ! [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: version '${v}' is not valid semver." >&2
    return 1
  fi
  echo "$v"
}

# _resolve_current_local_version
#   Same as _resolve_current_version, but for the local-only pointer
#   (.claude/state/arcanum-config.json's .migrations.version).
_resolve_current_local_version() {
  local v
  v="$(repo_config_get_version "$LOCAL_CONFIG_FILE" migrations)"
  if [[ -z "$v" ]]; then
    echo "Warning: no local version found in ${LOCAL_CONFIG_FILE} (.migrations.version) — treating as 0.0.0, all local-scoped migrations will run. See docs/guides/arcanum-repo-version.md." >&2
    echo "0.0.0"
    return 0
  fi
  if ! [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: local version '${v}' is not valid semver." >&2
    return 1
  fi
  echo "$v"
}

_reset_errors_file() {
  mkdir -p "$(dirname "$ERRORS_FILE")"
  LOCK_FILE="${ERRORS_FILE}.lock"
  _acquire_lock
  echo "[]" > "$ERRORS_FILE"
  _release_lock
}

_print_errors() {
  if [[ -s "$ERRORS_FILE" ]] && [[ "$(jq -c '.' "$ERRORS_FILE" 2>/dev/null)" != "[]" ]]; then
    echo "Errors encountered during migration:"
    jq -r '.[] | "  [\(.version)] \(.file) (skippable=\(.skippable)): \(.message)"' "$ERRORS_FILE"
  fi
}

# _pending_list <current_version> <current_local_version>
#   Fills the global PENDING array from _pending_versions.
_pending_list() {
  PENDING=()
  while IFS= read -r v; do
    [[ -n "$v" ]] && PENDING+=("$v")
  done < <(_pending_versions "$1" "$2")
}

# _run_all <version...>
#   Loops update_per_version.sh --no-confirm over each given version,
#   stopping immediately on a halt or a chat request. Returns 2 on
#   halt, 3 on [C]hat, 0 otherwise.
_run_all() {
  local rc=0 v
  for v in "$@"; do
    "${SCRIPT_DIR}/update_per_version.sh" "$v" --no-confirm --repo "$REPO_PATH" || rc=$?
    [[ "$rc" -eq 2 ]] && return 2
    [[ "$rc" -eq 3 ]] && return 3
  done
  return 0
}

cmd_check() {
  local current local_current
  current="$(_resolve_current_version)" || exit 1
  local_current="$(_resolve_current_local_version)" || exit 1

  _pending_list "$current" "$local_current"

  echo "CURRENT=${current}"
  echo "LOCAL=${local_current}"
  if [[ ${#PENDING[@]} -eq 0 ]]; then
    echo "STATUS=up_to_date"
  else
    local v
    for v in "${PENDING[@]}"; do
      echo "PENDING=${v}"
    done
  fi
  exit 0
}

cmd_apply() {
  local mode="${1:-}"

  case "$mode" in
    --all)
      local current local_current
      current="$(_resolve_current_version)" || exit 1
      local_current="$(_resolve_current_local_version)" || exit 1
      _pending_list "$current" "$local_current"

      if [[ ${#PENDING[@]} -eq 0 ]]; then
        echo "Up to date (repo version ${current}, local version ${local_current})."
        exit 0
      fi

      _reset_errors_file
      local rc=0
      _run_all "${PENDING[@]}" || rc=$?
      _print_errors
      [[ "$rc" -eq 2 ]] && exit 1
      exit 0
      ;;
    --none)
      exit 0
      ;;
    --select)
      local version="${2:?Usage: $0 apply --select <version>}"
      _reset_errors_file
      local rc=0
      "${SCRIPT_DIR}/update_per_version.sh" "$version" --no-confirm --repo "$REPO_PATH" || rc=$?
      _print_errors
      [[ "$rc" -eq 2 ]] && exit 1
      exit 0
      ;;
    *)
      echo "Usage: $0 apply --all|--none|--select <version>" >&2
      exit 1
      ;;
  esac
}

cmd_interactive() {
  local current local_current
  current="$(_resolve_current_version)" || exit 1
  local_current="$(_resolve_current_local_version)" || exit 1
  _pending_list "$current" "$local_current"

  if [[ ${#PENDING[@]} -eq 0 ]]; then
    echo "Up to date (repo version ${current}, local version ${local_current})."
    exit 0
  fi

  _reset_errors_file

  echo "Current version: ${current}"
  echo "Local version: ${local_current}"
  echo "Pending versions:"
  local v
  for v in "${PENDING[@]}"; do
    echo "  $v"
  done

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    echo "Error: no interactive terminal (/dev/tty) available to prompt for [A]ll/[N]one/[S]elect/[C]hat. Use 'check'/'apply' for non-interactive use, or run this from a real terminal." >&2
    exit 1
  fi
  printf '[A]ll/[N]one/[S]elect/[C]hat: '
  read -r choice < /dev/tty

  local rc=0
  case "$choice" in
    [Aa]*)
      _run_all "${PENDING[@]}" || rc=$?
      ;;
    [Ss]*)
      "${SCRIPT_DIR}/select_version.sh" --repo "$REPO_PATH" || rc=$?
      ;;
    [Cc]*)
      echo "CHAT_CONTEXT="
      exit 3
      ;;
    *)
      rc=0
      ;;
  esac

  [[ "$rc" -eq 3 ]] && exit 3

  _print_errors
  [[ "$rc" -eq 2 ]] && exit 1
  exit 0
}

case "${1:-}" in
  check)
    cmd_check
    ;;
  apply)
    shift
    cmd_apply "$@"
    ;;
  "")
    cmd_interactive
    ;;
  *)
    echo "Usage: $0 [--repo <path>] [check|apply --all|--none|--select <version>]" >&2
    exit 1
    ;;
esac
