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
# shellcheck source=origin.sh
source "${_ENGINE_DISPATCH_LIB_DIR}/origin.sh"

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

# Fixed in-container paths for the forwarded SSH agent socket
# (docs/agents/specs/docker/environment.md#git-remote-access).
_ENGINE_DISPATCH_DOCKER_LINUX_SSH_SOCK="/run/arcanum/ssh-agent.sock"
_ENGINE_DISPATCH_DOCKER_MACOS_SSH_SOCK="/run/host-services/ssh-auth.sock"

# _engine_dispatch_docker_abs_path <path>
#   Prints <path> made absolute against $PWD (unchanged when already
#   absolute), with `.`/`..` resolved when its directory exists. Never
#   resolves symlinks, so it compares against <repo_path> as given.
_engine_dispatch_docker_abs_path() {
  local p="$1"
  if [[ "$p" == /* ]]; then
    echo "$p"
  elif [[ -d "${PWD}/${p}" ]]; then
    (cd "${PWD}/${p}" && pwd)
  elif [[ -d "$(dirname "${PWD}/${p}")" ]]; then
    echo "$(cd "$(dirname "${PWD}/${p}")" && pwd)/$(basename "$p")"
  else
    echo "${PWD}/${p}"
  fi
}

# _engine_dispatch_docker_inside <path> <dir>
#   Exits 0 when <path> is <dir> itself or nested under it.
_engine_dispatch_docker_inside() {
  local path="$1" dir="${2%/}"
  [[ "$path" == "$dir" || "$path" == "$dir"/* ]]
}

# _engine_dispatch_docker_gh_token <repo_path>
#   Prints the gh token resolved on the host: GH_TOKEN, else
#   GITHUB_TOKEN, else `gh auth token --hostname <host> [--user
#   <ghuser>]` (host and ghuser via origin.sh). Prints nothing when no
#   token can be obtained; never prompts, always exits 0.
_engine_dispatch_docker_gh_token() {
  local repo_path="$1"
  if [[ -n "${GH_TOKEN:-}" ]]; then
    echo "$GH_TOKEN"
    return 0
  fi
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "$GITHUB_TOKEN"
    return 0
  fi
  command -v gh >/dev/null 2>&1 || return 0
  local host ghuser cmd=(gh auth token)
  host=$(get_domain "$repo_path" 2>/dev/null) || host=""
  ghuser=$(cd "$repo_path" 2>/dev/null && get_gh_user)
  [[ -n "$host" ]] && cmd+=(--hostname "$host")
  [[ -n "$ghuser" ]] && cmd+=(--user "$ghuser")
  "${cmd[@]}" </dev/null 2>/dev/null || true
}

# _engine_dispatch_docker_run <ref>
#   Runs this call in a `darthjee/arcanum` container and returns
#   `docker run`'s exit code unchanged (stdin attached, stdout/stderr
#   untouched). Reads engine_dispatch's own locals (bash dynamic
#   scoping): repo_path, command, prepend_repo_path, env_allowlist,
#   needs_tags, path_args and args.
#
#   argv, in order (docs/agents/specs/docker/dispatch.md "`docker run`
#   invocation shape"): the fixed flags; `-v <repo>:<repo>`; the git
#   common dir (worktrees) and log directory mounts; the --needs mounts;
#   the --path-arg mounts (equal or nested sources collapsed); `-e NAME`
#   entries (fixed env, --needs env, then each set allowlisted name
#   except HOME and PATH); <ref>; then exactly what
#   _engine_dispatch_run_native passes to core/bin/arcanum (command,
#   optional repo path, args — relative path args that the container's
#   working directory would resolve differently made absolute).
#
#   Runs in a subshell: the values behind every `-e NAME` are exported
#   there only (never in argv), so nothing leaks into the caller.
# shellcheck disable=SC2154  # engine_dispatch's locals, via dynamic scoping
_engine_dispatch_docker_run() (
  local ref="$1"
  local repo="${repo_path%/}"

  # shellcheck disable=SC2054  # the commas belong to the --tmpfs value
  local run_args=(run --rm -i --init --label arcanum.dispatch=1
    --user "$(id -u):$(id -g)"
    --read-only --tmpfs /tmp:rw,exec,mode=1777
    --cap-drop ALL --security-opt no-new-privileges
    -w "$repo_path" -v "${repo_path}:${repo_path}")

  local env_names=() git_config=()
  local name

  # --- Repo-derived mounts and safe.directory entries ---
  git_config+=("safe.directory" "$repo_path")
  if [[ -f "${repo}/.git" ]]; then
    local common_dir
    common_dir=$(git -C "$repo_path" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || common_dir=""
    if [[ -n "$common_dir" ]]; then
      run_args+=(-v "${common_dir}:${common_dir}")
      git_config+=("safe.directory" "$common_dir")
    fi
  fi

  local log_dir
  log_dir=$(cd "$repo_path" && config_chain_read "$repo_path" engine log.location)
  log_dir="${log_dir#\"}"
  log_dir="${log_dir%\"}"
  if [[ -n "$log_dir" ]]; then
    [[ "$log_dir" != /* ]] && log_dir="${repo}/${log_dir}"
    if [[ -d "$log_dir" ]] && ! _engine_dispatch_docker_inside "$log_dir" "$repo"; then
      run_args+=(-v "${log_dir}:${log_dir}")
    fi
  fi

  # --- --needs ---
  local tags=" "
  [[ ${#needs_tags[@]} -gt 0 ]] && tags=" ${needs_tags[*]} "
  local needs_env=() gh_needed="false"

  if [[ "$tags" == *" global-config "* ]]; then
    export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}"
    local global_file="${CLAUDE_CONFIG_DIR}/arcanum-config.json"
    [[ -f "$global_file" ]] && run_args+=(-v "${global_file}:${global_file}:ro")
    needs_env+=(CLAUDE_CONFIG_DIR)
  fi

  if [[ "$tags" == *" gitconfig "* ]]; then
    local candidate git_global=""
    for candidate in "${GIT_CONFIG_GLOBAL:-}" "${HOME:-}/.gitconfig" "${XDG_CONFIG_HOME:-${HOME:-}/.config}/git/config"; do
      if [[ -n "$candidate" && -f "$candidate" ]]; then
        git_global="$candidate"
        break
      fi
    done
    if [[ -n "$git_global" ]]; then
      run_args+=(-v "${git_global}:${git_global}:ro")
      export GIT_CONFIG_GLOBAL="$git_global"
      needs_env+=(GIT_CONFIG_GLOBAL)
    fi
  fi

  [[ "$tags" == *" gh "* ]] && gh_needed="true"

  if [[ "$tags" == *" remote "* ]]; then
    local origin_url
    origin_url=$(git -C "$repo_path" remote get-url origin 2>/dev/null) || origin_url=""
    if [[ "$origin_url" == git@* || "$origin_url" == ssh://* ]]; then
      if [[ "$(uname)" == "Darwin" ]]; then
        run_args+=(-v "${_ENGINE_DISPATCH_DOCKER_MACOS_SSH_SOCK}:${_ENGINE_DISPATCH_DOCKER_MACOS_SSH_SOCK}")
        export SSH_AUTH_SOCK="$_ENGINE_DISPATCH_DOCKER_MACOS_SSH_SOCK"
        needs_env+=(SSH_AUTH_SOCK)
      elif [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
        run_args+=(-v "${SSH_AUTH_SOCK}:${_ENGINE_DISPATCH_DOCKER_LINUX_SSH_SOCK}")
        export SSH_AUTH_SOCK="$_ENGINE_DISPATCH_DOCKER_LINUX_SSH_SOCK"
        needs_env+=(SSH_AUTH_SOCK)
      fi
      local known_hosts="${HOME:-}/.ssh/known_hosts"
      [[ -f "$known_hosts" ]] && run_args+=(-v "${known_hosts}:${known_hosts}:ro")
      export GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=${known_hosts} -o StrictHostKeyChecking=yes"
      needs_env+=(GIT_SSH_COMMAND)
    elif [[ "$origin_url" == http://* || "$origin_url" == https://* ]]; then
      gh_needed="true"
      git_config+=("credential.helper" "" "credential.helper" "!gh auth git-credential")
    fi
  fi

  if [[ "$gh_needed" == "true" ]]; then
    local token host
    token=$(_engine_dispatch_docker_gh_token "$repo_path")
    host=$(get_domain "$repo_path" 2>/dev/null) || host=""
    if [[ -n "$host" && "$host" != "github.com" ]]; then
      export GH_HOST="$host"
      needs_env+=(GH_HOST)
      if [[ -n "$token" ]]; then
        export GH_ENTERPRISE_TOKEN="$token"
        needs_env+=(GH_ENTERPRISE_TOKEN)
      fi
    elif [[ -n "$token" ]]; then
      export GH_TOKEN="$token"
      needs_env+=(GH_TOKEN)
    fi
  fi

  # --- --path-arg mounts and argv rewrites ---
  local container_args=()
  [[ ${#args[@]} -gt 0 ]] && container_args=("${args[@]}")
  local pa_src=() pa_mode=()
  local spec idx mode arg abs src j merged
  if [[ ${#path_args[@]} -gt 0 ]]; then
    for spec in "${path_args[@]}"; do
      idx="${spec%%:*}"
      mode="${spec#*:}"
      [[ $idx -le ${#container_args[@]} ]] || continue
      arg="${container_args[idx - 1]}"
      [[ -n "$arg" ]] || continue
      abs=$(_engine_dispatch_docker_abs_path "$arg")
      if _engine_dispatch_docker_inside "$abs" "$repo"; then
        # Inside the repo: no mount; a relative path only needs
        # rewriting when the shim's $PWD is not the container's
        # working directory (the repo).
        [[ "$arg" != /* && "${PWD%/}" != "$repo" ]] && container_args[idx - 1]="$abs"
        continue
      fi
      [[ "$arg" != /* ]] && container_args[idx - 1]="$abs"
      if [[ "$mode" == "ro" ]]; then
        [[ -e "$abs" ]] || continue
        src="$abs"
      else
        src="$(dirname "$abs")"
        [[ -d "$src" ]] || continue
      fi

      merged="false"
      for ((j = 0; j < ${#pa_src[@]}; j++)); do
        [[ -n "${pa_src[j]}" ]] || continue
        if [[ "$src" == "${pa_src[j]}" ]]; then
          [[ "$mode" == "rw" ]] && pa_mode[j]="rw"
          merged="true"
          break
        fi
        if [[ "$src" == "${pa_src[j]}"/* ]] && [[ "${pa_mode[j]}" == "rw" || "$mode" == "ro" ]]; then
          merged="true"
          break
        fi
        if [[ "${pa_src[j]}" == "$src"/* ]] && [[ "$mode" == "rw" || "${pa_mode[j]}" == "ro" ]]; then
          pa_src[j]=""
        fi
      done
      if [[ "$merged" == "false" ]]; then
        pa_src+=("$src")
        pa_mode+=("$mode")
      fi
    done
  fi
  for ((j = 0; j < ${#pa_src[@]}; j++)); do
    [[ -n "${pa_src[j]}" ]] || continue
    if [[ "${pa_mode[j]}" == "ro" ]]; then
      run_args+=(-v "${pa_src[j]}:${pa_src[j]}:ro")
    else
      run_args+=(-v "${pa_src[j]}:${pa_src[j]}")
    fi
  done

  # --- Env: fixed, then --needs, then the allowlist (names only) ---
  export ARCANUM_IN_DOCKER=1
  export ARCANUM_REPO_PATH="$repo_path"
  env_names+=(ARCANUM_IN_DOCKER ARCANUM_REPO_PATH GIT_CONFIG_COUNT)
  export GIT_CONFIG_COUNT=$((${#git_config[@]} / 2))
  for ((j = 0; j < GIT_CONFIG_COUNT; j++)); do
    export "GIT_CONFIG_KEY_${j}=${git_config[j * 2]}"
    export "GIT_CONFIG_VALUE_${j}=${git_config[j * 2 + 1]}"
    env_names+=("GIT_CONFIG_KEY_${j}" "GIT_CONFIG_VALUE_${j}")
  done
  [[ ${#needs_env[@]} -gt 0 ]] && env_names+=("${needs_env[@]}")

  if [[ ${#env_allowlist[@]} -gt 0 ]]; then
    for name in "${env_allowlist[@]}"; do
      [[ "$name" == "HOME" || "$name" == "PATH" ]] && continue
      [[ -n "${!name+x}" ]] || continue
      case " ${env_names[*]} " in
        *" ${name} "*) continue ;;
      esac
      export "${name?}"
      env_names+=("$name")
    done
  fi
  for name in "${env_names[@]}"; do
    run_args+=(-e "$name")
  done

  run_args+=("$ref" "$command")
  [[ "$prepend_repo_path" == "true" ]] && run_args+=("$repo_path")
  [[ ${#container_args[@]} -gt 0 ]] && run_args+=("${container_args[@]}")

  docker "${run_args[@]}"
)
