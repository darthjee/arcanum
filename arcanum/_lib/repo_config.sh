# Shared per-repo, namespaced configuration helpers, with legacy-file
# fallback.
#
# Used by anything that reads/writes an arcanum feature's own config
# under a shared, namespaced file (e.g.
# `.claude/configuration/arcanum-repo-config.json` or
# `.claude/state/arcanum-config.json`), while still supporting repos that
# haven't migrated off a legacy, feature-specific file yet (e.g.
# `.claude/configuration/auto-fix-all.json`). See
# docs/guides/arcanum-repo-config.md for the end-user-facing explanation
# of this fallback.
#
# This file is meant to be SOURCED, not executed directly. Every public
# function takes explicit file paths as given by the caller (relative to
# the target repo root, same convention every other arcanum script
# uses) — no cwd assumptions beyond that.

_REPO_CONFIG_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lock.sh
source "${_REPO_CONFIG_LIB_DIR}/lock.sh"

# repo_config_read <new_file> <legacy_file> <namespace> <key>
#   Prints (jq -c, compact) the value of .<namespace>.<key> from
#   <new_file> if present (presence-checked, so a value of `false`/`0`
#   still counts). Otherwise, if <legacy_file> has <key> at its top
#   level, prints that value (jq -c) and warns on stderr that the
#   config has moved. Otherwise prints nothing. Always exits 0 —
#   callers apply their own default for an empty result.
#
#   <key> may be a dot-separated path (e.g. "agents.architect"), in
#   which case it's resolved as a nested path under <namespace> via jq
#   getpath instead of direct indexing — e.g. "agents.architect" under
#   namespace "git" resolves `.git | getpath(["agents","architect"])`.
#   A getpath lookup that doesn't exist and one that's explicitly
#   `null` both count as "absent", same convention already used for
#   flat keys. Keys without a "." behave exactly as before (direct
#   .[$ns][$k] indexing). The <legacy_file> fallback only supports flat
#   keys — no dotted-path lookup is attempted there.
repo_config_read() {
  local new_file="$1" legacy_file="$2" namespace="$3" key="$4"

  if [[ "$key" == *.* ]]; then
    if [[ -f "$new_file" ]] && jq -e --arg ns "$namespace" --arg k "$key" \
        '($k | split(".")) as $p | (.[$ns] // {}) | getpath($p) != null' "$new_file" >/dev/null 2>&1; then
      jq -c --arg ns "$namespace" --arg k "$key" \
        '($k | split(".")) as $p | (.[$ns] // {}) | getpath($p)' "$new_file"
      return 0
    fi
  elif [[ -f "$new_file" ]] && jq -e --arg ns "$namespace" --arg k "$key" \
      '(.[$ns] // {}) | has($k)' "$new_file" >/dev/null 2>&1; then
    jq -c --arg ns "$namespace" --arg k "$key" '.[$ns][$k]' "$new_file"
    return 0
  fi

  if [[ -f "$legacy_file" ]] && jq -e --arg k "$key" 'has($k)' "$legacy_file" >/dev/null 2>&1; then
    jq -c --arg k "$key" '.[$k]' "$legacy_file"
    echo "Warning: reading '${key}' from legacy config file ${legacy_file} — this configuration has moved to ${new_file}. See docs/guides/arcanum-repo-config.md." >&2
    return 0
  fi

  return 0
}

# _repo_config_seed_locked <new_file> <legacy_file> <namespace>
#   Internal, already-locked seed step shared by repo_config_seed and
#   repo_config_write. Must only be called while already holding
#   <new_file>.lock.
_repo_config_seed_locked() {
  local new_file="$1" legacy_file="$2" namespace="$3"

  if [[ -f "$new_file" ]] && jq -e --arg ns "$namespace" 'has($ns)' "$new_file" >/dev/null 2>&1; then
    return 0
  fi
  [[ -f "$legacy_file" ]] || return 0

  mkdir -p "$(dirname "$new_file")"

  local base="{}"
  if [[ -f "$new_file" ]] && jq -e . "$new_file" >/dev/null 2>&1; then
    base="$(cat "$new_file")"
  fi

  jq --arg ns "$namespace" --slurpfile legacy "$legacy_file" \
    '.[$ns] = $legacy[0]' <<<"$base" > "${new_file}.tmp"
  mv "${new_file}.tmp" "$new_file"
}

# repo_config_seed <new_file> <legacy_file> <namespace>
#   Idempotent, lock-protected. No-op if <new_file> already has
#   .<namespace>, or if <legacy_file> doesn't exist. Otherwise sets
#   .<namespace> on <new_file> to the full contents of <legacy_file>,
#   preserving any other namespaces/content already present in
#   <new_file>. Creates <new_file> (and its parent dir) if needed.
repo_config_seed() {
  local new_file="$1" legacy_file="$2" namespace="$3"
  mkdir -p "$(dirname "$new_file")"
  LOCK_FILE="${new_file}.lock"
  _acquire_lock
  _repo_config_seed_locked "$new_file" "$legacy_file" "$namespace"
  _release_lock
}

# repo_config_write <new_file> <legacy_file> <namespace> <key> <json_value>
#   <json_value> is a pre-formed JSON literal string (e.g. true, false,
#   "a string", [1,2]) — the caller is responsible for shaping it.
#   Lock-protected (same lock file as repo_config_seed — both race the
#   same file, so they must share a lock). Ensures <new_file> exists
#   (seeding from <legacy_file> under <namespace> if needed, same rule
#   as repo_config_seed), then sets .<namespace>.<key> = <json_value>
#   on top, atomically.
repo_config_write() {
  local new_file="$1" legacy_file="$2" namespace="$3" key="$4" json_value="$5"
  mkdir -p "$(dirname "$new_file")"
  LOCK_FILE="${new_file}.lock"
  _acquire_lock

  _repo_config_seed_locked "$new_file" "$legacy_file" "$namespace"

  local base="{}"
  if [[ -f "$new_file" ]] && jq -e . "$new_file" >/dev/null 2>&1; then
    base="$(cat "$new_file")"
  fi

  jq --arg ns "$namespace" --arg k "$key" --argjson v "$json_value" \
    '.[$ns] = ((.[$ns] // {}) | .[$k] = $v)' <<<"$base" > "${new_file}.tmp"
  mv "${new_file}.tmp" "$new_file"

  _release_lock
}

# repo_config_get_version <file> [<namespace>]
#   Prints .version (raw string) from <file>, or nothing if the file/
#   field is absent or null. Read-only, no locking.
#
#   With <namespace> given, reads the namespaced pointer
#   .<namespace>.version instead of the top-level one — used for the
#   local-only migrations pointer (namespace "migrations") living in
#   .claude/state/arcanum-config.json, alongside the committed,
#   top-level .version in .claude/configuration/arcanum-repo-config.json.
#   See docs/guides/arcanum-repo-version.md.
repo_config_get_version() {
  local file="$1" namespace="${2:-}"
  [[ -f "$file" ]] || return 0
  if [[ -n "$namespace" ]]; then
    jq -r --arg ns "$namespace" '.[$ns].version // empty' "$file" 2>/dev/null
  else
    jq -r '.version // empty' "$file" 2>/dev/null
  fi
}

# repo_config_set_version <file> <version> [<namespace>]
#   Lock-protected, using the same lock file <file>.lock so this can't
#   race repo_config_write/repo_config_seed on the same file. Sets
#   .version = "<version>" on <file> (or .<namespace>.version = "<version>"
#   when <namespace> is given — see repo_config_get_version above),
#   creating it as {} first if absent, atomically.
repo_config_set_version() {
  local file="$1" version="$2" namespace="${3:-}"
  mkdir -p "$(dirname "$file")"
  LOCK_FILE="${file}.lock"
  _acquire_lock

  local base="{}"
  if [[ -f "$file" ]] && jq -e . "$file" >/dev/null 2>&1; then
    base="$(cat "$file")"
  fi

  if [[ -n "$namespace" ]]; then
    jq --arg ns "$namespace" --arg v "$version" \
      '.[$ns] = ((.[$ns] // {}) | .version = $v)' <<<"$base" > "${file}.tmp"
  else
    jq --arg v "$version" '.version = $v' <<<"$base" > "${file}.tmp"
  fi
  mv "${file}.tmp" "$file"

  _release_lock
}
