#!/usr/bin/env bash
# Top-level per-repo migration runner entry point.
# Usage: run.sh
#        run.sh check
#        run.sh apply --all|--none|--select <version>
#
# Reads the repo's currently recorded arcanum version from the
# top-level .version field in
# .claude/configuration/arcanum-repo-config.json. If absent, treats it
# as 0.0.0 and warns (all migrations will run — see
# docs/guides/arcanum-repo-version.md). If present but not valid semver
# (X.Y.Z), hard-errors rather than guessing.
#
# Pending versions are the folders under arcanum/migrations/repos/
# (excluding "next") strictly greater than the current version,
# compared numerically field-by-field (not lexicographically — e.g.
# 0.10.0 > 0.9.0), sorted ascending.
#
# --- Form 1: `run.sh` (no args) --- fully interactive, direct terminal
# use. Prints the current version and pending list, prompts (/dev/tty)
# [A]ll/[N]one/[S]elect:
#   [A]ll     -> loops pending versions ascending, calling
#                update_per_version.sh <version> --no-confirm for each;
#                stops immediately if one exits 2 (halt).
#   [N]one    -> exits 0, untouched.
#   [S]elect  -> delegates to select_version.sh.
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
# in the chain.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"
CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
ERRORS_FILE=".claude/state/arcanum-errors.json"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=../_lib/lock.sh
source "${SCRIPT_DIR}/../_lib/lock.sh"
# shellcheck source=_pending_versions.sh
source "${SCRIPT_DIR}/_pending_versions.sh"

# _resolve_current_version
#   Prints the resolved current version (0.0.0 + stderr warning if
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

# _pending_list <current_version>
#   Fills the global PENDING array from _pending_versions.
_pending_list() {
  PENDING=()
  while IFS= read -r v; do
    [[ -n "$v" ]] && PENDING+=("$v")
  done < <(_pending_versions "$1")
}

# _run_all <version...>
#   Loops update_per_version.sh --no-confirm over each given version,
#   stopping immediately on a halt. Returns 2 on halt, 0 otherwise.
_run_all() {
  local rc=0 v
  for v in "$@"; do
    "${SCRIPT_DIR}/update_per_version.sh" "$v" --no-confirm || rc=$?
    [[ "$rc" -eq 2 ]] && return 2
  done
  return 0
}

cmd_check() {
  local current
  current="$(_resolve_current_version)" || exit 1

  _pending_list "$current"

  echo "CURRENT=${current}"
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
      local current
      current="$(_resolve_current_version)" || exit 1
      _pending_list "$current"

      if [[ ${#PENDING[@]} -eq 0 ]]; then
        echo "Up to date (version ${current})."
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
      "${SCRIPT_DIR}/update_per_version.sh" "$version" --no-confirm || rc=$?
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
  local current
  current="$(_resolve_current_version)" || exit 1
  _pending_list "$current"

  if [[ ${#PENDING[@]} -eq 0 ]]; then
    echo "Up to date (version ${current})."
    exit 0
  fi

  _reset_errors_file

  echo "Current version: ${current}"
  echo "Pending versions:"
  local v
  for v in "${PENDING[@]}"; do
    echo "  $v"
  done
  printf '[A]ll/[N]one/[S]elect: '
  read -r choice < /dev/tty

  local rc=0
  case "$choice" in
    [Aa]*)
      _run_all "${PENDING[@]}" || rc=$?
      ;;
    [Ss]*)
      "${SCRIPT_DIR}/select_version.sh" || rc=$?
      ;;
    *)
      rc=0
      ;;
  esac

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
    echo "Usage: $0 [check|apply --all|--none|--select <version>]" >&2
    exit 1
    ;;
esac
