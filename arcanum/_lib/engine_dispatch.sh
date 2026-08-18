#!/usr/bin/env bash
# Shared shell/native/docker dispatch guard. Every migrated entrypoint's
# shim script sources this file and calls engine_dispatch() to decide,
# for one call, whether to run its existing shell implementation or the
# centralized native entrypoint (core/bin/arcanum). See
# docs/agents/architecture/script-engine.md for the full design.
#
# Compatible with bash 3.2 (macOS's default /bin/bash) — array
# expansions are guarded against the empty-array-under-`set -u`
# "unbound variable" pitfall throughout (bash 3.2 raises that error even
# for `"${arr[@]}"` on a declared-but-empty array; bash >=4.4 does not).
#
# This file is meant to be SOURCED, not executed directly.

_ENGINE_DISPATCH_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_chain.sh
source "${_ENGINE_DISPATCH_LIB_DIR}/config_chain.sh"

_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="${_ENGINE_DISPATCH_LIB_DIR}/migration-status.json"
# core/bin/arcanum lives two levels up from arcanum/_lib
# (arcanum/_lib -> arcanum -> repo root -> core/bin/arcanum) — this is
# arcanum's OWN installation layout, unrelated to <repo_path> (the
# *target* repo being operated on, threaded through only for
# config_chain_read below).
_ENGINE_DISPATCH_NATIVE_BIN="$(cd "${_ENGINE_DISPATCH_LIB_DIR}/../.." && pwd)/core/bin/arcanum"

# _engine_dispatch_native_available <command>
#   Prints "true" if <command> maps to `true` in migration-status.json,
#   "false" for a `false` mapping, a missing key, or a missing/malformed
#   map file (native-not-available is always the safe default). Always
#   exits 0.
_engine_dispatch_native_available() {
  local command="$1"
  [[ -f "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE" ]] || { echo "false"; return 0; }

  local value
  value=$(jq -r --arg cmd "$command" '.[$cmd] // false' \
    "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE" 2>/dev/null)
  [[ "$value" == "true" ]] && echo "true" || echo "false"
}

# engine_dispatch <repo_path> <command> <shell_script> [<env_var_name> ...] -- <args...>
#   The shared dispatch guard for one migrated-entrypoint call.
#
#   - <repo_path>: the target repo whose engine.mode config is
#     consulted (arcanum/_lib/config_chain.sh) — required, never falls
#     back to ambient cwd (see
#     docs/agents/architecture/repo-path-threading.md).
#   - <command>: the migration-status.json key / core/bin/arcanum
#     routing key for this entrypoint.
#   - <shell_script>: path to the existing shell implementation, run
#     directly (engine.mode=shell) or as the fallback whenever native
#     isn't actually used.
#   - [<env_var_name> ...]: zero or more names of environment variables
#     (read from this process's own environment) to forward, by name,
#     to a native invocation — the explicit per-command allowlist
#     described in docs/agents/architecture/script-engine.md. Anything
#     not named here is NOT forwarded (no ambient-env passthrough).
#     This list is terminated by a literal `--`.
#   - <args...>: this entrypoint's own arguments, passed through
#     unchanged to whichever implementation actually runs.
#
#   Resolution (engine.mode via config_chain_read, default "shell"):
#     1. shell: always runs <shell_script>.
#     2. docker: always falls back to <shell_script>, with a warning on
#        stderr — the actual Docker execution path is out of scope for
#        now (#192); treated identically to "not available" below.
#     3. native: consults migration-status.json for <command>.
#        - Not available: falls back to <shell_script>, with a warning
#          on stderr (not a hard error).
#        - Available: invokes `core/bin/arcanum <command> <args...>`
#          with the explicit env-var allowlist above (`env -i`, PATH
#          plus only the named vars — never the full ambient
#          environment). A non-zero exit here is a real native-side
#          bug/crash and is propagated as-is, with NO fallback to
#          <shell_script>.
#
#   Exit code: whichever branch actually ran (<shell_script> or
#   core/bin/arcanum)'s own exit code.
engine_dispatch() {
  local repo_path="$1" command="$2" shell_script="$3"
  shift 3

  local env_allowlist=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    env_allowlist+=("$1")
    shift
  done
  [[ "${1:-}" == "--" ]] && shift

  local args=()
  [[ $# -gt 0 ]] && args=("$@")

  local shell_cmd=(bash "$shell_script")
  [[ ${#args[@]} -gt 0 ]] && shell_cmd+=("${args[@]}")

  local mode
  mode=$(cd "$repo_path" && config_chain_read "$repo_path" engine mode)
  mode="${mode//\"/}"
  mode="${mode:-shell}"

  if [[ "$mode" == "shell" ]]; then
    "${shell_cmd[@]}"
    return $?
  fi

  if [[ "$mode" == "docker" ]]; then
    echo "Warning: engine.mode=docker is not implemented yet for '${command}' — falling back to the shell implementation." >&2
    "${shell_cmd[@]}"
    return $?
  fi

  if [[ "$(_engine_dispatch_native_available "$command")" != "true" ]]; then
    echo "Warning: no native implementation of '${command}' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation." >&2
    "${shell_cmd[@]}"
    return $?
  fi

  local env_args=() var
  if [[ ${#env_allowlist[@]} -gt 0 ]]; then
    for var in "${env_allowlist[@]}"; do
      [[ -n "${!var+x}" ]] && env_args+=("${var}=${!var}")
    done
  fi

  local native_cmd=(env -i PATH="$PATH")
  [[ ${#env_args[@]} -gt 0 ]] && native_cmd+=("${env_args[@]}")
  native_cmd+=("$_ENGINE_DISPATCH_NATIVE_BIN" "$command")
  [[ ${#args[@]} -gt 0 ]] && native_cmd+=("${args[@]}")

  "${native_cmd[@]}"
  return $?
}
