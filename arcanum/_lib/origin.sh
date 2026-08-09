# Shared origin-resolution helpers.
#
# This file is meant to be SOURCED, not executed directly — it defines
# globals/functions used by scripts that need to resolve the git origin
# domain and repository path.
#
# Every public function here takes the target repo's local checkout path
# as a REQUIRED first argument (e.g. `get_repo_ref "$repo_path"`). There is
# no ambient-cwd fallback and no `--repo-path` flag — a missing argument is
# a hard usage error. This is intentional: callers must resolve the repo
# path once, at the top of their own flow, and thread it through explicitly
# rather than letting downstream steps re-derive it from whatever the shell's
# cwd happens to be at call time.

# --- Origin helpers (cached) ---

_ORIGIN_PARSED=0
_ORIGIN_DOMAIN=""
_ORIGIN_REPO_PATH=""
_ORIGIN_REPO_PATH_KEY=""

_load_origin() {
  local repo_path="${1:?_load_origin requires a repo path argument}"

  [[ "$_ORIGIN_PARSED" -eq 1 && "$_ORIGIN_REPO_PATH_KEY" == "$repo_path" ]] && return 0

  local origin
  origin=$(git -C "$repo_path" remote get-url origin 2>/dev/null) || {
    echo "Error: '$repo_path' is not a git repository or has no 'origin' remote" >&2
    exit 1
  }

  if [[ "$origin" =~ ^git@ ]]; then
    _ORIGIN_DOMAIN="${origin#git@}"
    _ORIGIN_DOMAIN="${_ORIGIN_DOMAIN%%:*}"
    _ORIGIN_REPO_PATH="${origin#*:}"
    _ORIGIN_REPO_PATH="${_ORIGIN_REPO_PATH%.git}"
  elif [[ "$origin" =~ ^https?:// ]]; then
    local stripped="${origin#*://}"
    _ORIGIN_DOMAIN="${stripped%%/*}"
    _ORIGIN_REPO_PATH="${stripped#*/}"
    _ORIGIN_REPO_PATH="${_ORIGIN_REPO_PATH%.git}"
  else
    echo "Error: unrecognized origin format: $origin" >&2
    exit 1
  fi

  _ORIGIN_REPO_PATH_KEY="$repo_path"
  _ORIGIN_PARSED=1
}

get_repo_ref() {
  local repo_path="${1:?get_repo_ref requires a repo path argument}"
  _load_origin "$repo_path"
  if [[ "$_ORIGIN_DOMAIN" == "github.com" ]]; then
    echo "$_ORIGIN_REPO_PATH"
  else
    echo "$_ORIGIN_DOMAIN/$_ORIGIN_REPO_PATH"
  fi
}

get_domain() {
  local repo_path="${1:?get_domain requires a repo path argument}"
  _load_origin "$repo_path"
  echo "$_ORIGIN_DOMAIN"
}

get_repo_path() {
  local repo_path="${1:?get_repo_path requires a repo path argument}"
  _load_origin "$repo_path"
  echo "$_ORIGIN_REPO_PATH"
}

get_gh_user() {
  git config user.ghuser 2>/dev/null || git config --global user.ghuser 2>/dev/null || true
}

_ensure_gh_user() {
  local ghuser
  ghuser=$(get_gh_user)
  if [[ -n "$ghuser" ]]; then
    gh auth switch --user "$ghuser" >/dev/null 2>&1 || \
      echo "Warning: gh auth switch --user $ghuser failed; proceeding with current gh user" >&2
  fi
}
