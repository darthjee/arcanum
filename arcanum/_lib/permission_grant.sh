# Shared helper for appending Claude Code Bash-permission allowlist
# patterns into Claude Code's own native settings files
# (.claude/settings.local.json, .claude/settings.json, or
# ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json) — NOT arcanum's
# own namespaced config files (see repo_config.sh/global_config.sh for
# those; that shape is `.<namespace>.<key> = <scalar>`, whereas here
# `.permissions.allow` is a plain, non-namespaced, Claude-Code-native
# key holding an array to append-and-dedupe into, not a scalar to
# overwrite).
#
# Used by:
#   - the local/repo/global `shipit`-merge-exemption migrations
#     (arcanum/migrations/repos/next/*.sh) — see issue #170.
#   - init-claude/setup_permissions.md's onboarding step, which calls
#     this file's own CLI dispatcher directly (below), since it runs
#     as an agent issuing Bash-tool commands rather than a script that
#     can `source` a lib.
#
# This file is meant to be SOURCED for its `permission_grant_add`
# function; the CLI dispatcher at the bottom is a secondary, direct-
# invocation convenience only.

_PERMISSION_GRANT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lock.sh
source "${_PERMISSION_GRANT_LIB_DIR}/lock.sh"

# permission_grant_add <file> <pattern>
#   Appends <pattern> to <file>'s top-level `.permissions.allow` array,
#   creating the file (starting from `{}`) and/or the array as needed,
#   deduping against whatever is already there
#   (`+ [$pattern] | unique`), without disturbing any other content
#   already in <file> (e.g. `.permissions.deny`, hooks, or any other
#   top-level key). Lock-protected (reuses lock.sh), atomic write
#   (.tmp file + mv).
#
#   Degrades silently (stderr warning, no-op, still exits 0) if <file>'s
#   parent directory can't be created — same failure posture as
#   global_config_write in global_config.sh.
permission_grant_add() {
  local file="$1" pattern="$2"

  if ! mkdir -p "$(dirname "$file")" 2>/dev/null; then
    echo "Warning: could not create the parent directory for ${file} — permission pattern '${pattern}' was not written." >&2
    return 0
  fi

  LOCK_FILE="${file}.lock"
  _acquire_lock

  local base="{}"
  if [[ -f "$file" ]] && jq -e . "$file" >/dev/null 2>&1; then
    base="$(cat "$file")"
  fi

  jq --arg p "$pattern" \
    '.permissions.allow = ((.permissions.allow // []) + [$p] | unique)' \
    <<<"$base" > "${file}.tmp"
  mv "${file}.tmp" "$file"

  _release_lock
}

# Direct-invocation CLI dispatcher: `permission_grant.sh add <file> <pattern>`.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    add)
      shift
      permission_grant_add "$@"
      ;;
    *)
      echo "Usage: $0 add <file> <pattern>" >&2
      exit 1
      ;;
  esac
fi
