#!/usr/bin/env bash
# Resolve and drive an arcanum self-update, for the arcanum-update skill.
# Usage: run_update.sh check
#        run_update.sh apply
#
# Both subcommands resolve TARGET/METHOD/REPO relative to this script's own
# location (<script_dir>/../.. — the install this skill lives inside),
# mirroring arcanum/update/bootstrap.sh's own on-disk-location detection:
#   - arcanum.json present at TARGET   -> METHOD=zip,  REPO/CURRENT read
#     from it (via jq).
#   - arcanum.json absent, .git present -> METHOD=git, REPO parsed from
#     `git remote get-url origin`, CURRENT is the exact tag on HEAD if
#     any, else the short commit hash.
#   - Neither present, or arcanum/update/bootstrap.sh missing entirely
#     (partial/manual install) -> prints "STATUS=missing_arcanum" to
#     stdout and exits 1.
#
# `check` prints, one per line (order matters — simple KEY=value parsing
# on the caller's side): METHOD=zip|git, REPO=<repo>, CURRENT=<version-or
# -ref>, TARGET=<path>. Exits 0.
#
# `apply` sets ARCANUM_ASSUME_YES=1 and runs arcanum/update/bootstrap.sh
# directly, streaming its stdout/stderr live (not captured/suppressed).
# On nonzero exit, propagates that same exit code with no further output
# (the caller relays the already-streamed error). On exit 0, re-resolves
# the current version/ref and prints one final line:
#   RESULT=updated FROM=<old> TO=<new>   (something changed)
#   RESULT=noop VERSION=<current>        (already up to date)
#
# Requires jq (zip-path case only) and git (git-path case only) — both
# already hard dependencies of the scripts this wraps.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP="${SCRIPT_DIR}/../../arcanum/update/bootstrap.sh"

# parse_github_owner_repo <target>
#   Echoes "<owner>/<repo>" parsed from <target>'s "origin" remote URL.
#   Supports git@github.com:owner/repo.git and https://github.com/owner/repo.git
#   forms (".git" suffix stripped either way). Returns nonzero if there's
#   no "origin" remote or its URL doesn't match either form.
parse_github_owner_repo() {
  local target="$1"
  local url
  url="$(git -C "$target" remote get-url origin 2>/dev/null)" || return 1
  url="${url%.git}"
  case "$url" in
    git@github.com:*)     echo "${url#git@github.com:}" ;;
    https://github.com/*) echo "${url#https://github.com/}" ;;
    *)                    return 1 ;;
  esac
}

# resolve_target
#   Sets the module-level METHOD/REPO/TARGET_PATH globals. Returns 1
#   (leaving them unset) if bootstrap.sh isn't where it's expected, or
#   neither arcanum.json nor .git is present at TARGET_PATH.
resolve_target() {
  [[ -f "$BOOTSTRAP" ]] || return 1

  TARGET_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"

  if [[ -f "${TARGET_PATH}/arcanum.json" ]]; then
    METHOD="zip"
    REPO="$(jq -r '.repo // empty' "${TARGET_PATH}/arcanum.json" 2>/dev/null || true)"
  elif [[ -d "${TARGET_PATH}/.git" ]]; then
    METHOD="git"
    REPO="$(parse_github_owner_repo "$TARGET_PATH" || true)"
  else
    return 1
  fi
}

# current_version
#   Echoes the current version (zip) or ref (git) for TARGET_PATH/METHOD.
#   Must be called after a successful resolve_target.
current_version() {
  case "$METHOD" in
    zip)
      jq -r '.version // empty' "${TARGET_PATH}/arcanum.json"
      ;;
    git)
      local tag
      tag="$(git -C "$TARGET_PATH" describe --tags --exact-match 2>/dev/null || true)"
      if [[ -n "$tag" ]]; then
        echo "$tag"
      else
        git -C "$TARGET_PATH" rev-parse --short HEAD
      fi
      ;;
  esac
}

cmd_check() {
  if ! resolve_target; then
    echo "STATUS=missing_arcanum"
    exit 1
  fi

  CURRENT="$(current_version)"

  echo "METHOD=${METHOD}"
  echo "REPO=${REPO}"
  echo "CURRENT=${CURRENT}"
  echo "TARGET=${TARGET_PATH}"
}

cmd_apply() {
  if ! resolve_target; then
    echo "STATUS=missing_arcanum"
    exit 1
  fi

  local before after rc
  before="$(current_version)"

  export ARCANUM_ASSUME_YES=1

  rc=0
  "$BOOTSTRAP" || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi

  after="$(current_version)"

  if [[ "$after" != "$before" ]]; then
    echo "RESULT=updated FROM=${before} TO=${after}"
  else
    echo "RESULT=noop VERSION=${after}"
  fi
}

case "${1:-}" in
  check) cmd_check ;;
  apply) cmd_apply ;;
  *)
    echo "Usage: $0 check" >&2
    echo "       $0 apply" >&2
    exit 1
    ;;
esac
