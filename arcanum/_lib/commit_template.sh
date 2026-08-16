# Shared "which commit message template shape is active" helper.
#
# This file is meant to be SOURCED, not executed directly — it defines
# a function used by the commit_*.sh scripts (commit_change.sh,
# commit_issue.sh, commit_plan.sh) to decide, at commit time, whether
# the target repo has opted into the new commit message template (with
# its per-agent "Co-Authored-By" email, see agent_email.sh) or is still
# on the legacy template (fixed, model-only email on both
# "Co-Authored-By" lines).
#
# No repo_path argument — like safe_branch.sh/agent_email.sh, operates
# on the ambient cwd, which callers must have already entered via
# repo_path_enter (see docs/agents/architecture/repo-path-threading.md)
# before calling this. All three commit_*.sh
# callers already do this before their commit logic runs, so there is
# no need for this lib to take an explicit <repo_path> and re-resolve
# paths outside the ambient cwd.
#
# Guard against double-sourcing:
[[ -n "${_LIB_COMMIT_TEMPLATE_LOADED:-}" ]] && return 0
_LIB_COMMIT_TEMPLATE_LOADED=1

# commit_template_engine_get
#   Prints "new" or "old" depending on which commit-message template
#   file is found in the ambient cwd, in order:
#     1. .github/commit_message_template-2.0.md -> "new"
#     2. .github/commit_message_template.md      -> "old"
#     3. neither present -> "new" (arcanum's own installed
#        commit_message_template-2.0.md always exists as the
#        ultimate fallback; its content is documentation only, its
#        mere existence is never actually checked — this branch is
#        reached purely by elimination)
commit_template_engine_get() {
  if [[ -f ".github/commit_message_template-2.0.md" ]]; then
    echo "new"
  elif [[ -f ".github/commit_message_template.md" ]]; then
    echo "old"
  else
    echo "new"
  fi
}
