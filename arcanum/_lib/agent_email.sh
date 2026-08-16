# Shared "agent commit-author email" helper.
#
# This file is meant to be SOURCED, not executed directly — it defines
# a function used by the commit_*.sh scripts (commit_change.sh,
# commit_issue.sh, commit_plan.sh) to build the "Co-Authored-By" line
# that identifies which agent authored a commit, when the repo has
# opted into the new commit message template (see commit_template.sh).
#
# No repo_path argument — operates on the ambient cwd, which callers
# must have already entered via repo_path_enter (see
# docs/agents/architecture/repo-path-threading.md).
#
# Guard against double-sourcing:
[[ -n "${_LIB_AGENT_EMAIL_LOADED:-}" ]] && return 0
_LIB_AGENT_EMAIL_LOADED=1

_AGENT_EMAIL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config_chain.sh
source "${_AGENT_EMAIL_LIB_DIR}/config_chain.sh"

# agent_email_get <agent> <model_email>
#   Prints the commit-author email for <agent>: the "git"."email"
#   pattern resolved via config_chain_read (local state ->
#   repo config -> global user config), falling back to <model_email>
#   when none of the three tiers has a usable value. A JSON `null`
#   value at any tier is treated identically to an absent key. The
#   resolved pattern has every "{agent}" occurrence substituted with
#   the literal <agent> name before being printed.
#
#   No repo_path argument of its own (see this file's header) — "."
#   (the already-entered ambient cwd) is passed through to
#   config_chain_read, whose own repo_path argument is unused/ignored
#   by the global tier anyway (see global_config.sh).
agent_email_get() {
  local agent="$1" model_email="$2" email
  email=$(config_chain_read "." "git" "email")
  email="${email//\"/}"
  [[ -n "$email" && "$email" != "null" ]] || { echo "$model_email"; return; }
  echo "${email//\{agent\}/$agent}"
}
