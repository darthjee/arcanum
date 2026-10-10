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

# _engine_dispatch_status <command> <native_only>
#   The single reader of migration-status.json
#   ($_ENGINE_DISPATCH_MIGRATION_STATUS_FILE). Prints exactly one line,
#   one of `shell`, `native`, `docker`, `host-only`, and always exits 0.
#   <native_only> is "true" for a --native-only entrypoint (one with no
#   shell implementation), "false" otherwise.
#
#   - A known enum value is printed as-is, except that `shell` becomes
#     `native` when <native_only> is "true".
#   - A legacy boolean maps `true` -> `native`, `false` -> `shell`
#     (`native` when <native_only> is "true").
#   - Anything else (missing key, unknown string, number, null, object,
#     missing file, malformed JSON) -> the safe default: `shell`, or
#     `native` when <native_only> is "true".
_engine_dispatch_status() {
  local command="$1" native_only="$2"
  local default="shell"
  [[ "$native_only" == "true" ]] && default="native"

  local value=""
  if [[ -f "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE" ]]; then
    value=$(jq -r --arg cmd "$command" \
      '.[$cmd] | if type == "string" then . elif type == "boolean" then (if . then "true" else "false" end) else "" end' \
      "$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE" 2>/dev/null) || value=""
  fi

  case "$value" in
    shell) echo "$default" ;;
    native | docker | host-only) echo "$value" ;;
    true) echo "native" ;;
    *) echo "$default" ;;
  esac
}

# _engine_dispatch_run_native <repo_path> <command> <prepend_repo_path> <env_count> [<env_var_name> ...] [<args...>]
#   Runs `core/bin/arcanum <command> [<repo_path>] <args...>` under
#   `env -i`, with PATH, ARCANUM_REPO_PATH=<repo_path> and only the
#   <env_count> named env vars that follow (each forwarded only when set
#   in this process's environment). <prepend_repo_path> is "true" to put
#   <repo_path> ahead of <args...>. Everything after the <env_count>
#   names is <args...>. Returns core/bin/arcanum's exit code. Shared by
#   engine_dispatch's regular native branch and its --native-only mode.
_engine_dispatch_run_native() {
  local repo_path="$1" command="$2" prepend_repo_path="$3" env_count="$4"
  shift 4

  local env_args=() var i
  for ((i = 0; i < env_count; i++)); do
    var="$1"
    shift
    [[ -n "${!var+x}" ]] && env_args+=("${var}=${!var}")
  done

  local native_cmd=(env -i PATH="$PATH" ARCANUM_REPO_PATH="$repo_path")
  [[ ${#env_args[@]} -gt 0 ]] && native_cmd+=("${env_args[@]}")
  native_cmd+=("$_ENGINE_DISPATCH_NATIVE_BIN" "$command")
  [[ "$prepend_repo_path" == "true" ]] && native_cmd+=("$repo_path")
  [[ $# -gt 0 ]] && native_cmd+=("$@")

  "${native_cmd[@]}"
  return $?
}

# engine_dispatch <repo_path> <command> <shell_script> [--prepend-repo-path] [--native-only] [<env_var_name> ...] -- <args...>
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
#   - [--prepend-repo-path]: optional literal flag (recognized anywhere
#     in the env-var-name segment below, since real env var names never
#     contain `-`, so this can never collide with one) — when present,
#     <repo_path> is prepended as a native-only leading positional
#     argument, ahead of <args...>, to the `core/bin/arcanum` invocation
#     ONLY (never to <shell_script>). For `context: 'repo'` commands
#     whose own CLI never took a <repo_path> argument from its existing
#     callers (e.g. discuss-issue/scripts/render_issue.sh) — the
#     Dispatcher (core/lib/core/dispatcher.js) always consumes the
#     native invocation's own leading positional as `repoPath` on that
#     context, so it must be supplied somehow; for entrypoints whose
#     <shell_script> takes the exact same leading argument itself
#     (e.g. commit_change_shell.sh), just include <repo_path> as the
#     first element of <args...> instead — this flag is only for the
#     mismatched case where <shell_script>'s own CLI must NOT receive
#     it.
#   - [<env_var_name> ...]: zero or more names of environment variables
#     (read from this process's own environment) to forward, by name,
#     to a native invocation — the explicit per-command allowlist
#     described in docs/agents/architecture/script-engine.md. Anything
#     not named here is NOT forwarded (no ambient-env passthrough).
#     This list (and the optional --prepend-repo-path flag above) is
#     terminated by a literal `--`.
#   - <args...>: this entrypoint's own arguments, passed through
#     unchanged to whichever implementation actually runs (with
#     <repo_path> prepended ahead of them for the native invocation only,
#     when --prepend-repo-path is given).
#
#   Resolution (engine.mode via config_chain_read, default "shell"):
#     1. shell: always runs <shell_script>.
#     2. docker: always falls back to <shell_script>, with a warning on
#        stderr — the actual Docker execution path is out of scope for
#        now (#192); treated identically to "not available" below.
#     3. native: reads <command>'s status from migration-status.json via
#        _engine_dispatch_status (a string enum: `shell`, `native`,
#        `docker` or `host-only`; a missing/unknown entry reads as
#        `shell`).
#        - Status `shell` (no native implementation yet): falls back to
#          <shell_script>, with a warning on stderr (not a hard error).
#        - Any other status (`native`, `docker`, `host-only`): invokes `core/bin/arcanum <command> [<repo_path>] <args...>`
#          (the leading `<repo_path>` present only when
#          --prepend-repo-path was given) with the explicit env-var
#          allowlist above (`env -i`, PATH and ARCANUM_REPO_PATH
#          (infrastructure-level, always set to <repo_path>) plus only
#          the named vars — never the full ambient environment). A
#          non-zero exit here is a real native-side bug/crash and is
#          propagated as-is, with NO fallback to <shell_script>.
#
#   [--native-only]: optional literal flag (recognized in the same
#   segment as --prepend-repo-path, anywhere before `--`), for commands
#   that have NO shell implementation at all. <shell_script> is passed as
#   an empty string "" in this mode and is never run, and
#   migration-status.json is NOT consulted (native-only commands are
#   listed with a non-`shell` status, but this path does not consult the
#   map yet (docker branch, #729)). Resolution then becomes:
#     - docker: prints `Error: engine.mode=docker is not implemented yet
#       for native-only command '<command>'.` on stderr and returns 1 —
#       no fallback, nothing on stdout.
#     - anything else (unset/shell/native): runs the exact same native
#       invocation as step 3's non-`shell` case above (same env-var
#       allowlist and --prepend-repo-path handling), propagating its exit
#       code.
#
#   Exit code: whichever branch actually ran (<shell_script> or
#   core/bin/arcanum)'s own exit code.
engine_dispatch() {
  local repo_path="$1" command="$2" shell_script="$3"
  shift 3

  local prepend_repo_path="false" native_only="false"
  local env_allowlist=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    if [[ "$1" == "--prepend-repo-path" ]]; then
      prepend_repo_path="true"
    elif [[ "$1" == "--native-only" ]]; then
      native_only="true"
    else
      env_allowlist+=("$1")
    fi
    shift
  done
  [[ "${1:-}" == "--" ]] && shift

  local args=()
  [[ $# -gt 0 ]] && args=("$@")

  # Full _engine_dispatch_run_native argument list — never empty, so its
  # expansion is bash 3.2-safe without a guard.
  local native_call=("$repo_path" "$command" "$prepend_repo_path" "${#env_allowlist[@]}")
  [[ ${#env_allowlist[@]} -gt 0 ]] && native_call+=("${env_allowlist[@]}")
  [[ ${#args[@]} -gt 0 ]] && native_call+=("${args[@]}")

  local mode
  mode=$(cd "$repo_path" && config_chain_read "$repo_path" engine mode)
  mode="${mode//\"/}"
  mode="${mode:-shell}"

  if [[ "$native_only" == "true" ]]; then
    if [[ "$mode" == "docker" ]]; then
      echo "Error: engine.mode=docker is not implemented yet for native-only command '${command}'." >&2
      return 1
    fi
    _engine_dispatch_run_native "${native_call[@]}"
    return $?
  fi

  local shell_cmd=(bash "$shell_script")
  [[ ${#args[@]} -gt 0 ]] && shell_cmd+=("${args[@]}")

  if [[ "$mode" == "shell" ]]; then
    "${shell_cmd[@]}"
    return $?
  fi

  if [[ "$mode" == "docker" ]]; then
    echo "Warning: engine.mode=docker is not implemented yet for '${command}' — falling back to the shell implementation." >&2
    "${shell_cmd[@]}"
    return $?
  fi

  if [[ "$(_engine_dispatch_status "$command" false)" == "shell" ]]; then
    echo "Warning: no native implementation of '${command}' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation." >&2
    "${shell_cmd[@]}"
    return $?
  fi

  _engine_dispatch_run_native "${native_call[@]}"
  return $?
}
