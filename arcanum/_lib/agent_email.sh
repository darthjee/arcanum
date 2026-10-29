# shellcheck shell=bash
# Shared "agent commit-author email" helper.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by the commit scripts (commit_change.sh,
# commit_issue.sh, commit_plan.sh, cleanup_artifacts.sh) to build the
# "Co-Authored-By" trailers of a commit (see coauthor_trailers), whose
# agent line uses a per-agent email when the repo has opted into the
# new commit message template (see commit_template.sh).
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
# shellcheck source=commit_template.sh
source "${_AGENT_EMAIL_LIB_DIR}/commit_template.sh"

# agent_email_get <agent> <model_email>
#   Prints the commit-author email for <agent>, resolved via
#   config_chain_read (local state -> repo config -> global user
#   config) with two-key, per-tier precedence: within each tier, the
#   explicit "git"."agents"."<agent>" mapping is tried first, then the
#   generic "git"."email" templated pattern — a tier is fully resolved
#   (both keys tried) before the next tier is ever consulted, so a
#   generic value at a higher-precedence tier still beats an
#   agent-specific value at a lower-precedence tier. Falls back to
#   <model_email> when none of the three tiers has a usable value for
#   either key. A JSON `null` value at any tier/key is treated
#   identically to an absent key. Any "{agent}" occurrence in the
#   resolved value is substituted with the literal <agent> name before
#   being printed — a no-op when the resolved value is a concrete
#   "git.agents.<agent>" email with no such placeholder.
#
#   No repo_path argument of its own (see this file's header) — "."
#   (the already-entered ambient cwd) is passed through to
#   config_chain_read, whose own repo_path argument is unused/ignored
#   by the global tier anyway (see global_config.sh).
agent_email_get() {
  local agent="$1" model_email="$2" email
  email=$(config_chain_read "." "git" "agents.${agent}" "email")
  email="${email//\"/}"
  [[ -n "$email" && "$email" != "null" ]] || { echo "$model_email"; return; }
  echo "${email//\{agent\}/$agent}"
}

# model_coauthor_omitted
#   Prints "true" if the "git"."omit_model_coauthor" key (resolved via
#   config_chain_read: local state -> repo config -> global) is truthy,
#   "false" otherwise (including when absent/null/any other value) —
#   default false, purely opt-in. Both the JSON boolean `true` and the
#   JSON string "true" count as truthy (surrounding quotes are stripped
#   before comparing).
model_coauthor_omitted() {
  local value
  value=$(config_chain_read "." "git" "omit_model_coauthor")
  value="${value#\"}"
  value="${value%\"}"
  [[ "$value" == "true" ]] && { echo "true"; return; }
  echo "false"
}

# coauthor_trailers <agent> <model_name> <model_email>
#   Prints the "Co-Authored-By:" trailer lines for a commit authored by
#   <agent>, one per line, in order:
#     1. "Co-Authored-By: <model_name> <<model_email>>" — only when
#        model_coauthor_omitted is not "true";
#     2. "Co-Authored-By: <agent> agent <<agent_email>>" — always,
#        except when the model co-author is omitted AND <agent_email>
#        equals <model_email> (it would just re-attribute the model).
#   <agent_email> is agent_email_get's value under the "new" commit
#   template engine (see commit_template.sh), <model_email> under the
#   "old" one. Prints nothing when both lines are dropped — callers
#   must then skip the blank separator line before the trailers.
coauthor_trailers() {
  local agent="$1" model_name="$2" model_email="$3" agent_email omit
  agent_email="$model_email"
  if [[ "$(commit_template_engine_get)" == "new" ]]; then
    agent_email="$(agent_email_get "$agent" "$model_email")"
  fi
  omit="$(model_coauthor_omitted)"
  if [[ "$omit" != "true" ]]; then
    echo "Co-Authored-By: ${model_name} <${model_email}>"
  fi
  if [[ "$omit" != "true" || "$agent_email" != "$model_email" ]]; then
    echo "Co-Authored-By: ${agent} agent <${agent_email}>"
  fi
}

# remove_coauthors_list
#   Prints the "git"."remove_coauthors" array (resolved via
#   config_chain_read: local state -> repo config -> global), as raw
#   jq-compact JSON, or "[]" when absent/null/empty — default empty
#   list, purely opt-in.
remove_coauthors_list() {
  local value
  value=$(config_chain_read "." "git" "remove_coauthors")
  [[ -n "$value" ]] && { echo "$value"; return; }
  echo "[]"
}
