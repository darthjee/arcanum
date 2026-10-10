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

# shellcheck source=lock.sh
source "${_ENGINE_DISPATCH_LIB_DIR}/lock.sh"

# The image repository dispatch pulls/builds (`<repository>:<version>`).
_ENGINE_DISPATCH_DOCKER_REPOSITORY="darthjee/arcanum"

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

# _engine_dispatch_docker_install_version
#   Prints the arcanum install's version, resolved from
#   $_ENGINE_DISPATCH_INSTALL_ROOT the way InstallVersion /
#   stamp_arcanum_version_shell.sh do: arcanum.json `.version` (zip
#   install), else the exact git tag on HEAD (git-clone install, `.git`
#   a directory), else `local-<short HEAD>` (a dev install between tags,
#   or a worktree). Prints `local-unknown` when nothing resolves.
_engine_dispatch_docker_install_version() {
  local root="$_ENGINE_DISPATCH_INSTALL_ROOT" version=""
  if [[ -f "${root}/arcanum.json" ]]; then
    version="$(jq -r '.version // empty' "${root}/arcanum.json" 2>/dev/null || true)"
  elif [[ -d "${root}/.git" ]]; then
    version="$(git -C "$root" describe --tags --exact-match HEAD 2>/dev/null || true)"
  fi
  if [[ -z "$version" ]]; then
    local short
    short="$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)"
    version="local-${short:-unknown}"
  fi
  echo "$version"
}

# _engine_dispatch_docker_image_ref
#   Prints the image reference for this call:
#   $_ENGINE_DISPATCH_DOCKER_IMAGE as-is when non-empty, else
#   `darthjee/arcanum:<install version>`.
_engine_dispatch_docker_image_ref() {
  if [[ -n "${_ENGINE_DISPATCH_DOCKER_IMAGE:-}" ]]; then
    echo "$_ENGINE_DISPATCH_DOCKER_IMAGE"
    return 0
  fi
  echo "${_ENGINE_DISPATCH_DOCKER_REPOSITORY}:$(_engine_dispatch_docker_install_version)"
}

# _engine_dispatch_docker_inspect <ref>
#   Prints `present`, `missing` or `daemon` — the outcome of one
#   `docker image inspect`. Its stdout never reaches dispatch's stdout.
_engine_dispatch_docker_inspect() {
  local ref="$1" err
  if err=$(docker image inspect --format '{{.Id}}' "$ref" 2>&1 >/dev/null); then
    echo "present"
  elif [[ "$err" == *"Cannot connect to the Docker daemon"* ]]; then
    echo "daemon"
  else
    echo "missing"
  fi
}

# _engine_dispatch_docker_acquire_image <ref>
#   Pulls <ref> (unless it is a `darthjee/arcanum:local-` ref), else
#   builds it from $_ENGINE_DISPATCH_INSTALL_ROOT, under the image lock
#   (${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock) so concurrent
#   first calls don't race. Re-inspects once the lock is held, since
#   another caller may have finished meanwhile. Progress goes to stderr
#   only. Exits 0 when the image is present afterwards, 1 otherwise. The
#   lock is released on every path.
_engine_dispatch_docker_acquire_image() {
  local ref="$1"
  local lock_dir="${XDG_CACHE_HOME:-${HOME:-}/.cache}/arcanum"
  mkdir -p "$lock_dir" 2>/dev/null || return 1
  local LOCK_FILE="${lock_dir}/image.lock"

  _acquire_lock
  local rc=1
  if [[ "$(_engine_dispatch_docker_inspect "$ref")" == "present" ]]; then
    rc=0
  else
    if [[ "$ref" != "${_ENGINE_DISPATCH_DOCKER_REPOSITORY}:local-"* ]]; then
      echo "Info: pulling ${ref} (first docker call for this version)…" >&2
      docker pull "$ref" >&2 && rc=0
    fi
    if [[ $rc -ne 0 ]]; then
      local root="$_ENGINE_DISPATCH_INSTALL_ROOT"
      echo "Info: building ${ref}…" >&2
      docker build -f "${root}/core/Dockerfile" --target runtime \
        --build-arg "ARCANUM_VERSION=${ref##*:}" -t "$ref" "$root" >&2 && rc=0
    fi
  fi
  _release_lock
  return $rc
}

# _engine_dispatch_docker_available <ref>
#   The Docker availability check (docs/agents/specs/docker/dispatch.md
#   "Docker availability check"). Exits 0, printing nothing, when <ref>
#   can run; otherwise prints the row-4 <reason> (`docker not found`,
#   `daemon not reachable`, `image <ref> unavailable`) and exits 1. The
#   image lock is taken only when a pull or build is actually needed.
_engine_dispatch_docker_available() {
  local ref="$1"
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found"
    return 1
  fi
  case "$(_engine_dispatch_docker_inspect "$ref")" in
    present) return 0 ;;
    daemon)
      echo "daemon not reachable"
      return 1
      ;;
  esac
  if ! _engine_dispatch_docker_acquire_image "$ref"; then
    echo "image ${ref} unavailable"
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
