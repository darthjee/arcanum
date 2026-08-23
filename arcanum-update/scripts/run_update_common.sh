#!/usr/bin/env bash
# Shared constants/helpers for arcanum-update's run_update_check_shell.sh
# and run_update_apply_shell.sh — factored out of the old single
# run_update.sh so neither of the two scripts duplicates them.
#
# This file is meant to be SOURCED, not executed directly.

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

# resolve_target <target_path>
#   Sets the module-level METHOD/REPO/TARGET_PATH globals. Returns 1
#   (leaving them unset) if bootstrap.sh isn't where it's expected, or
#   neither arcanum.json nor .git is present at <target_path>.
resolve_target() {
  local target_path="$1"
  local bootstrap="${target_path}/arcanum/update/bootstrap.sh"

  [[ -f "$bootstrap" ]] || return 1

  TARGET_PATH="$target_path"

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
