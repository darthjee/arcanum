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
# shellcheck source=engine_dispatch_docker.sh
source "${_ENGINE_DISPATCH_LIB_DIR}/engine_dispatch_docker.sh"

_ENGINE_DISPATCH_MIGRATION_STATUS_FILE="${_ENGINE_DISPATCH_LIB_DIR}/migration-status.json"
# The arcanum install root is two levels up from arcanum/_lib
# (arcanum/_lib -> arcanum -> install root; core/bin/arcanum lives
# under it, and it is the docker build context) — this is
# arcanum's OWN installation layout, unrelated to <repo_path> (the
# *target* repo being operated on, threaded through only for
# config_chain_read below).
_ENGINE_DISPATCH_INSTALL_ROOT="$(cd "${_ENGINE_DISPATCH_LIB_DIR}/../.." && pwd)"
_ENGINE_DISPATCH_NATIVE_BIN="${_ENGINE_DISPATCH_INSTALL_ROOT}/core/bin/arcanum"
# The docker image reference. Empty (the default) means "resolve from
# $_ENGINE_DISPATCH_INSTALL_ROOT" (darthjee/arcanum:<version>, see
# _engine_dispatch_docker_image_ref); a non-empty value is used as-is.
# Specs override both variables after sourcing.
_ENGINE_DISPATCH_DOCKER_IMAGE=""

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
#   every branch of engine_dispatch that runs native.
#
#   Inside the container (ARCANUM_IN_DOCKER=1) it also forwards the
#   container infrastructure env (see
#   _engine_dispatch_docker_infra_env_names), each only when set, so a
#   nested call keeps the marker, HOME, git config and credentials of
#   its outer call. On the host it forwards nothing extra.
_engine_dispatch_run_native() {
  local repo_path="$1" command="$2" prepend_repo_path="$3" env_count="$4"
  shift 4

  local env_args=() var i
  for ((i = 0; i < env_count; i++)); do
    var="$1"
    shift
    [[ -n "${!var+x}" ]] && env_args+=("${var}=${!var}")
  done

  if [[ "${ARCANUM_IN_DOCKER:-}" == "1" ]]; then
    while IFS= read -r var; do
      [[ -n "${!var+x}" ]] && env_args+=("${var}=${!var}")
    done < <(_engine_dispatch_docker_infra_env_names)
  fi

  local native_cmd=(env -i PATH="$PATH" ARCANUM_REPO_PATH="$repo_path")
  [[ ${#env_args[@]} -gt 0 ]] && native_cmd+=("${env_args[@]}")
  native_cmd+=("$_ENGINE_DISPATCH_NATIVE_BIN" "$command")
  [[ "$prepend_repo_path" == "true" ]] && native_cmd+=("$repo_path")
  [[ $# -gt 0 ]] && native_cmd+=("$@")

  "${native_cmd[@]}"
  return $?
}

# engine_dispatch <repo_path> <command> <shell_script> [--prepend-repo-path] [--native-only] [--needs=<tag>[,<tag>...]]... [--path-arg=<index>:<ro|rw>]... [<env_var_name> ...] -- <args...>
#   The shared dispatch guard for one migrated-entrypoint call. See
#   docs/agents/architecture/script-engine.md and
#   docs/agents/specs/docker/dispatch.md for the full design.
#
#   - <repo_path>: the target repo whose engine.mode config is
#     consulted (arcanum/_lib/config_chain.sh) — required, never falls
#     back to ambient cwd (see
#     docs/agents/architecture/repo-path-threading.md).
#   - <command>: the migration-status.json key / core/bin/arcanum
#     routing key for this entrypoint.
#   - <shell_script>: path to the existing shell implementation, run
#     directly (engine.mode=shell) or as the fallback whenever native
#     isn't actually used. "" with --native-only.
#   - [--prepend-repo-path]: optional literal flag (recognized anywhere
#     before `--`; real env var names never contain `-`, so no flag can
#     collide with one) — when present, <repo_path> is prepended as a
#     leading positional argument, ahead of <args...>, to the
#     `core/bin/arcanum` invocation ONLY (native or in the container,
#     never to <shell_script>). For `context: 'repo'` commands whose own
#     CLI never took a <repo_path> argument from its existing callers
#     (e.g. discuss-issue/scripts/render_issue.sh) — the Dispatcher
#     (core/lib/core/dispatcher.js) always consumes the native
#     invocation's own leading positional as `repoPath` on that context.
#     For entrypoints whose <shell_script> takes the same leading
#     argument itself (e.g. commit_change_shell.sh), include <repo_path>
#     as the first element of <args...> instead.
#   - [--native-only]: optional literal flag, for commands that have NO
#     shell implementation at all. <shell_script> is never run. Under
#     engine.mode shell/native the command always runs native, without
#     consulting migration-status.json; under docker it follows the
#     docker resolution table below (its status can never read `shell`).
#   - [--needs=<tag>[,<tag>...]]: repeatable; tags `global-config`,
#     `gitconfig`, `gh`, `remote` — the extra mounts and env a container
#     call needs. Ignored outside the container path.
#   - [--path-arg=<index>:<ro|rw>]: repeatable; marks <args...>[index]
#     (1-based, never counting the --prepend-repo-path repo path) as a
#     file path to mount into the container. Ignored outside the
#     container path.
#     An unknown --needs tag or a malformed --path-arg value prints
#     `Error: engine_dispatch: invalid <flag> '<value>'.` (where <value>
#     is everything after `=`) on stderr and returns 1.
#   - [<env_var_name> ...]: names of environment variables (read from
#     this process's own environment) to forward, by name, to a native
#     or container invocation — the explicit per-command allowlist. Not
#     named here means NOT forwarded (no ambient-env passthrough). The
#     whole flag/name segment is terminated by a literal `--`.
#   - <args...>: this entrypoint's own arguments, passed through to
#     whichever implementation actually runs.
#
#   Nested guard (first, before engine.mode is read): when
#   ARCANUM_IN_DOCKER=1 (a call made from inside the container), a
#   status of `shell` (dual entrypoints only) runs <shell_script>, any
#   other status runs native directly. No warning, no docker call.
#
#   Resolution (engine.mode via config_chain_read, default "shell"):
#     1. shell: runs <shell_script> (native for --native-only).
#     2. native: --native-only runs native. Otherwise reads <command>'s
#        status via _engine_dispatch_status: `shell` falls back to
#        <shell_script> with a warning on stderr; any other status runs
#        native.
#     3. docker: reads <command>'s status via _engine_dispatch_status:
#        - `host-only`: native on the host, no warning.
#        - `native`: native on the host, with the "not docker-ready yet"
#          warning.
#        - `shell` (dual only): <shell_script>, with the "no native
#          implementation" warning.
#        - `docker`: the Docker availability check, then `docker run`.
#          Docker unavailable (or `docker run` itself exiting 125-127)
#          falls back to native on the host with the "Docker is
#          unavailable (<reason>)" warning.
#
#   Native runs use `env -i` with PATH, ARCANUM_REPO_PATH and the
#   allowlist (see _engine_dispatch_run_native). A non-zero native or
#   container exit is propagated as-is, with NO fallback to
#   <shell_script>. Every fallback prints exactly one warning line on
#   stderr and leaves stdout untouched.
#
#   Exit code: whichever implementation actually ran's own exit code.
engine_dispatch() {
  local repo_path="$1" command="$2" shell_script="$3"
  shift 3

  local prepend_repo_path="false" native_only="false"
  local env_allowlist=() needs_tags=() path_args=()
  local value split_tags=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    case "$1" in
      --prepend-repo-path) prepend_repo_path="true" ;;
      --native-only) native_only="true" ;;
      --needs=*)
        value="${1#--needs=}"
        if ! _engine_dispatch_docker_valid_needs "$value"; then
          echo "Error: engine_dispatch: invalid --needs '${value}'." >&2
          return 1
        fi
        IFS=',' read -r -a split_tags <<< "$value"
        needs_tags+=("${split_tags[@]}")
        ;;
      --path-arg=*)
        value="${1#--path-arg=}"
        if ! _engine_dispatch_docker_valid_path_arg "$value"; then
          echo "Error: engine_dispatch: invalid --path-arg '${value}'." >&2
          return 1
        fi
        path_args+=("$value")
        ;;
      *) env_allowlist+=("$1") ;;
    esac
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

  local shell_cmd=(bash "$shell_script")
  [[ ${#args[@]} -gt 0 ]] && shell_cmd+=("${args[@]}")

  local status
  if [[ "${ARCANUM_IN_DOCKER:-}" == "1" ]]; then
    status=$(_engine_dispatch_status "$command" "$native_only")
    if [[ "$status" == "shell" ]]; then
      "${shell_cmd[@]}"
      return $?
    fi
    _engine_dispatch_run_native "${native_call[@]}"
    return $?
  fi

  local mode
  mode=$(cd "$repo_path" && config_chain_read "$repo_path" engine mode)
  mode="${mode//\"/}"
  mode="${mode:-shell}"

  if [[ "$mode" == "docker" ]]; then
    status=$(_engine_dispatch_status "$command" "$native_only")
    case "$status" in
      host-only)
        _engine_dispatch_run_native "${native_call[@]}"
        return $?
        ;;
      native)
        echo "Warning: '${command}' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host." >&2
        _engine_dispatch_run_native "${native_call[@]}"
        return $?
        ;;
      shell)
        echo "Warning: no native implementation of '${command}' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation." >&2
        "${shell_cmd[@]}"
        return $?
        ;;
    esac

    local ref reason code
    ref=$(_engine_dispatch_docker_image_ref)
    if reason=$(_engine_dispatch_docker_available "$ref"); then
      _engine_dispatch_docker_run
      code=$?
      case "$code" in
        125 | 126 | 127) reason="docker run failed with ${code}" ;;
        *) return "$code" ;;
      esac
    fi
    echo "Warning: Docker is unavailable (${reason}) — running '${command}' natively on the host. Fix Docker or change engine.mode." >&2
    _engine_dispatch_run_native "${native_call[@]}"
    return $?
  fi

  if [[ "$native_only" == "true" ]]; then
    _engine_dispatch_run_native "${native_call[@]}"
    return $?
  fi

  if [[ "$mode" == "shell" ]]; then
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
