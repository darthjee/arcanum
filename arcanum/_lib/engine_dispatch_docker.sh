# shellcheck shell=bash
# Docker-only helpers for arcanum/_lib/engine_dispatch.sh (the
# engine.mode=docker branch, see docs/agents/specs/docker/dispatch.md).
# Every function here is an `_engine_dispatch_docker_*` helper; shims
# never call them directly, and specs keep sourcing only
# engine_dispatch.sh, which sources this file.
#
# Compatible with bash 3.2 — every array expansion is guarded against
# the empty-array-under-`set -u` pitfall, as in engine_dispatch.sh.
#
# This file is meant to be SOURCED (by engine_dispatch.sh), not executed
# directly.

# The `--needs=<tag>` values engine_dispatch accepts.
_ENGINE_DISPATCH_DOCKER_NEEDS_TAGS="global-config gitconfig gh remote"

# The container infrastructure env (docs/agents/specs/docker/
# environment.md#container-infrastructure-env) a nested call inside the
# container forwards on top of its own allowlist, each only when set.
# GIT_CONFIG_KEY_<n>/GIT_CONFIG_VALUE_<n> are added per GIT_CONFIG_COUNT
# by _engine_dispatch_docker_infra_env_names.
_ENGINE_DISPATCH_DOCKER_INFRA_ENV="ARCANUM_IN_DOCKER HOME CLAUDE_CONFIG_DIR GIT_CONFIG_GLOBAL GIT_CONFIG_COUNT GIT_SSH_COMMAND SSH_AUTH_SOCK GH_TOKEN GH_HOST GH_ENTERPRISE_TOKEN LD_PRELOAD NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP"

# _engine_dispatch_docker_valid_needs <value>
#   Exits 0 when <value> (the part after `--needs=`) is a non-empty,
#   comma-separated list of known tags, 1 otherwise.
_engine_dispatch_docker_valid_needs() {
  local value="$1" tag
  [[ -n "$value" && "$value" != *, && "$value" != ,* && "$value" != *,,* ]] || return 1
  local IFS=','
  for tag in $value; do
    case " ${_ENGINE_DISPATCH_DOCKER_NEEDS_TAGS} " in
      *" ${tag} "*) ;;
      *) return 1 ;;
    esac
  done
  return 0
}

# _engine_dispatch_docker_valid_path_arg <value>
#   Exits 0 when <value> (the part after `--path-arg=`) is
#   `<index>:<ro|rw>` with a 1-based positive index, 1 otherwise.
_engine_dispatch_docker_valid_path_arg() {
  [[ "$1" =~ ^[1-9][0-9]*:(ro|rw)$ ]]
}

# _engine_dispatch_docker_infra_env_names
#   Prints the container infrastructure env names, one per line,
#   including GIT_CONFIG_KEY_<n>/GIT_CONFIG_VALUE_<n> for every
#   n < GIT_CONFIG_COUNT (when that is a non-negative integer). Names
#   are printed whether or not they are set; the caller forwards only
#   the set ones.
_engine_dispatch_docker_infra_env_names() {
  local name n
  for name in $_ENGINE_DISPATCH_DOCKER_INFRA_ENV; do
    echo "$name"
  done
  if [[ "${GIT_CONFIG_COUNT:-}" =~ ^[0-9]+$ ]]; then
    for ((n = 0; n < GIT_CONFIG_COUNT; n++)); do
      echo "GIT_CONFIG_KEY_${n}"
      echo "GIT_CONFIG_VALUE_${n}"
    done
  fi
}

# _engine_dispatch_docker_unavailable_reason
#   Prints the row-4 <reason> and exits 1 when Docker can't run this
#   call; prints nothing and exits 0 when it can.
_engine_dispatch_docker_unavailable_reason() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found"
    return 1
  fi
  return 0
}

# _engine_dispatch_docker_run
#   Runs the call in a container (implemented in a later step); returns
#   docker run's exit code.
_engine_dispatch_docker_run() {
  return 125
}
