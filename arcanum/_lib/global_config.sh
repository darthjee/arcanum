# Global, cross-project, per-Claude-Code-account/profile configuration
# helpers — the third and outermost tier in arcanum's config resolution
# chain (local repo state -> repo config -> global user config ->
# hardcoded default; see arcanum/_lib/config_chain.sh).
#
# Resolved from ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json
# — the same env var Claude Code itself uses to relocate its own config
# directory for multi-account setups, falling back to Claude Code's own
# documented default (~/.claude) when unset. Bare filename, no
# subfolder — reuses the exact same base name as the repo-local file
# (.claude/state/arcanum-config.json). Not repo-scoped at all: this
# file lives outside every repo, shared across every project the
# active account/profile touches.
#
# This file is meant to be SOURCED, not executed directly. Every public
# function below takes a leading <repo_path> argument for signature
# consistency with every other arcanum script's repo_path-first-arg
# convention (see docs/agents/architecture/repo-path-threading.md) —
# it is accepted but unused/ignored here, since the global file's
# location never depends on which repo is calling.
#
# Alongside the read/write pair (global_config_read/global_config_write)
# for arbitrary namespaced keys, this file also carries the "global"
# migration scope's version pointer (global_config_get_version/
# global_config_set_version) — .migrations.version in the same file,
# reusing repo_config_get_version/repo_config_set_version (see
# repo_config.sh) against the resolved global file path. See
# arcanum/migrations/_manifest.sh for how the "global" applies_to scope
# uses this pointer.

_GLOBAL_CONFIG_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lock.sh
source "${_GLOBAL_CONFIG_LIB_DIR}/lock.sh"
# shellcheck source=repo_config.sh
source "${_GLOBAL_CONFIG_LIB_DIR}/repo_config.sh"

# _global_config_file
#   Prints the resolved path to the global config file, or nothing if
#   it can't be resolved (no $HOME and no CLAUDE_CONFIG_DIR). Always
#   exits 0.
_global_config_file() {
  local dir="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}"
  [[ -n "$dir" ]] || return 0
  echo "${dir}/arcanum-config.json"
}

# global_config_read <repo_path> <namespace> <key>
#   Prints (jq -c, compact) the value of .<namespace>.<key> from the
#   global config file if present (presence-checked, so a value of
#   `false`/`0` still counts). Prints nothing if the file is missing,
#   malformed, or unresolvable (no $HOME/CLAUDE_CONFIG_DIR available) —
#   a broken/absent global tier must never error, only degrade to "no
#   value". Always exits 0 — callers apply their own default for an
#   empty result. <repo_path> is accepted but unused/ignored, see this
#   file's header.
#
#   <key> may be a dot-separated path (e.g. "agents.architect"), in
#   which case it's resolved as a nested path under <namespace> via jq
#   getpath instead of direct indexing, mirroring repo_config_read (see
#   repo_config.sh) — a getpath lookup that doesn't exist and one
#   that's explicitly `null` both count as "absent". Keys without a "."
#   behave exactly as before (direct .[$ns][$k] indexing).
global_config_read() {
  local namespace="$2" key="$3"
  local file
  file="$(_global_config_file)"
  [[ -n "$file" && -f "$file" ]] || return 0

  if [[ "$key" == *.* ]]; then
    if jq -e --arg ns "$namespace" --arg k "$key" \
        '($k | split(".")) as $p | (.[$ns] // {}) | getpath($p) != null' "$file" >/dev/null 2>&1; then
      jq -c --arg ns "$namespace" --arg k "$key" \
        '($k | split(".")) as $p | (.[$ns] // {}) | getpath($p)' "$file"
    fi
  elif jq -e --arg ns "$namespace" --arg k "$key" \
      '(.[$ns] // {}) | has($k)' "$file" >/dev/null 2>&1; then
    jq -c --arg ns "$namespace" --arg k "$key" '.[$ns][$k]' "$file"
  fi

  return 0
}

# global_config_write <repo_path> <namespace> <key> <json_value>
#   <json_value> is a pre-formed JSON literal string (e.g. true, false,
#   "a string", [1,2]) — the caller is responsible for shaping it.
#   Lock-protected (lock file alongside the target file:
#   arcanum-config.json.lock), atomic write (via a .tmp file + mv).
#   Ensures the file's parent directory exists (mkdir -p), creating the
#   file fresh if absent, then sets .<namespace>.<key> = <json_value>
#   on top, preserving any other namespaces/content already present.
#   Default file permissions (644) — no extra restriction.
#
#   Degrades silently (warns on stderr, writes nothing, still exits 0)
#   if the global file's location can't be resolved or its parent
#   directory can't be created — a broken global tier must never take
#   down anything relying on it. <repo_path> is accepted but unused/
#   ignored, see this file's header.
global_config_write() {
  local namespace="$2" key="$3" json_value="$4"
  local file
  file="$(_global_config_file)"
  if [[ -z "$file" ]]; then
    echo "Warning: could not resolve a global config location (no \$HOME or \$CLAUDE_CONFIG_DIR) — '${namespace}.${key}' was not written." >&2
    return 0
  fi

  if ! mkdir -p "$(dirname "$file")" 2>/dev/null; then
    echo "Warning: could not create the global config directory for ${file} — '${namespace}.${key}' was not written." >&2
    return 0
  fi

  LOCK_FILE="${file}.lock"
  _acquire_lock

  local base="{}"
  if [[ -f "$file" ]] && jq -e . "$file" >/dev/null 2>&1; then
    base="$(cat "$file")"
  fi

  jq --arg ns "$namespace" --arg k "$key" --argjson v "$json_value" \
    '.[$ns] = ((.[$ns] // {}) | .[$k] = $v)' <<<"$base" > "${file}.tmp"
  mv "${file}.tmp" "$file"

  _release_lock
}

# global_config_get_version <repo_path>
#   Prints the global, cross-project migrations version pointer
#   (.migrations.version in the global config file — same namespaced
#   shape the local-only pointer already uses in
#   .claude/state/arcanum-config.json), or nothing if the global file's
#   location can't be resolved, or the file/field is absent. Read-only,
#   no locking. Always exits 0. <repo_path> is accepted but unused/
#   ignored, see this file's header.
global_config_get_version() {
  local file
  file="$(_global_config_file)"
  [[ -n "$file" ]] || return 0
  repo_config_get_version "$file" migrations
}

# global_config_set_version <repo_path> <version>
#   Sets the global, cross-project migrations version pointer
#   (.migrations.version in the global config file). Degrades silently
#   (warns on stderr, writes nothing, still exits 0) if the global
#   file's location can't be resolved — mirrors global_config_write's
#   existing degrade-on-write behavior. Otherwise lock-protected,
#   atomic write, via repo_config_set_version. <repo_path> is accepted
#   but unused/ignored, see this file's header.
global_config_set_version() {
  local version="$2"
  local file
  file="$(_global_config_file)"
  if [[ -z "$file" ]]; then
    echo "Warning: could not resolve a global config location (no \$HOME or \$CLAUDE_CONFIG_DIR) — 'migrations.version' was not written." >&2
    return 0
  fi
  repo_config_set_version "$file" "$version" migrations
}
