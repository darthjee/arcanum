# Shared "squash-merge commit body" helper.
#
# This file is meant to be SOURCED, not executed directly — it defines
# the functions used by `cmd_pr_merge` in
# `auto-fix-all/scripts/github.sh` (the only `gh pr merge` call site in
# the repo) to resolve the "git"."merge_body_mode" config key and,
# for "coauthors" mode, build the deduped `Co-authored-by:` block from
# a PR's commits. See docs/agents/issues/165-allow-merge-to-keep-coauthors.md
# for the full design.
#
# Guard against double-sourcing:
[[ -n "${_LIB_MERGE_BODY_LOADED:-}" ]] && return 0
_LIB_MERGE_BODY_LOADED=1

_MERGE_BODY_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_chain.sh
source "${_MERGE_BODY_LIB_DIR}/config_chain.sh"
# shellcheck source=agent_email.sh
source "${_MERGE_BODY_LIB_DIR}/agent_email.sh"

# merge_body_mode()
#   Prints one of "empty" / "full" / "coauthors" — the resolved
#   "git"."merge_body_mode" config value (local state -> repo config ->
#   global user config, via config_chain_read), validated against that
#   known set. An absent/empty/null value (the common, unconfigured
#   case) silently falls back to the hardcoded default "empty" — no
#   warning, since that's expected/normal. A present-but-unrecognized
#   value (e.g. a typo) additionally warns on stderr before falling
#   back to "empty". Never aborts — always exits 0 and always prints
#   exactly one of the three valid values.
merge_body_mode() {
  local value
  value=$(config_chain_read "." "git" "merge_body_mode")
  value="${value//\"/}"

  case "$value" in
    empty|full|coauthors)
      echo "$value"
      ;;
    *)
      [[ -z "$value" || "$value" == "null" ]] || \
        echo "Warning: unrecognized git.merge_body_mode value '${value}' — falling back to 'empty'." >&2
      echo "empty"
      ;;
  esac
}

# merge_body_coauthors_list <repo_path> <repo_ref> <number> [<model_email>]
#   Prints the deduped "Co-authored-by: Name <email>" block (one line
#   per author, no extra header/footer text) for "coauthors" mode,
#   built from the union of `authors[]` across every commit of PR
#   <number> on <repo_ref>. Prints nothing (empty string) if the
#   resulting list is empty — callers treat that the same as "no
#   custom body" (falling back to "full" mode's behavior).
#
#   <repo_path> is accepted but unused, kept only for signature
#   consistency with every other arcanum script's repo-path-first-arg
#   convention (see docs/agents/architecture/repo-path-threading.md).
#
#   Dedupes by email (entries with a null/missing/empty email are
#   skipped). Drops the entry whose login matches the acting merger's
#   own GitHub login (resolved via `gh api user -q '.login'` — callers
#   must have already run `_ensure_gh_user` before calling this
#   function). If that lookup fails for any reason, fails open: skips
#   the exclusion step only, keeps going with the full deduped list.
#   When <model_email> is given AND "git"."omit_model_coauthor" is
#   true (model_coauthor_omitted, see agent_email.sh), also drops the
#   entry whose email exactly matches <model_email>.
merge_body_coauthors_list() {
  local repo_path="$1" repo_ref="$2" number="$3" model_email="${4:-}"

  local authors_json
  authors_json=$(gh pr view -R "$repo_ref" "$number" --json commits | jq -c '[.commits[].authors[]]')

  local merger_login=""
  merger_login=$(gh api user -q '.login' 2>/dev/null) || merger_login=""

  local omit_model="false"
  [[ -n "$model_email" ]] && omit_model=$(model_coauthor_omitted)

  jq -r \
    --arg merger "$merger_login" \
    --arg model_email "$model_email" \
    --arg omit_model "$omit_model" \
    '
      map(select(.email != null and .email != ""))
      | unique_by(.email)
      | map(select($merger == "" or .login != $merger))
      | map(select($omit_model != "true" or .email != $model_email))
      | map("Co-authored-by: \(.name) <\(.email)>")
      | .[]
    ' <<<"$authors_json"

  return 0
}
