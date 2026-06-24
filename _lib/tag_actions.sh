# Shared tag-to-action mapping for Arcanum skills.
#
# This file is meant to be SOURCED, not executed directly. It depends on
# _lib/tags.sh (extract_tags/has_tag) being sourced first.
#
# It exposes the canonical list of actionable tags and a single detection
# function, actionable_tags. This is purely a detection/mapping layer — it
# does not perform the action itself (answering a question, rewriting an
# issue, pushing to a queue); those side effects belong in the caller
# (script-level for fully deterministic ones like the queue push, markdown
# / architect-level for ones that need AI judgment).
#
# Guard against double-sourcing:
[[ -n "${_LIB_TAG_ACTIONS_LOADED:-}" ]] && return 0
_LIB_TAG_ACTIONS_LOADED=1

# The three tags that drive monitor-issues dispatch, in canonical
# (colon-stripped) form, as also returned by extract_tags.
ACTIONABLE_TAGS=(question pencil2 clipboard)

# actionable_tags <text>
#   Scans <text> (raw issue body, or any text extract_tags can run on) and
#   prints, one per line, each of ACTIONABLE_TAGS that is present — in the
#   fixed order: question, pencil2, clipboard. Tags not present in <text>
#   are omitted. Prints nothing if none are present.
#   Exit status: 0 if at least one actionable tag was found, 1 otherwise.
actionable_tags() {
  local text="$1"
  local found=1
  local tag
  for tag in "${ACTIONABLE_TAGS[@]}"; do
    if has_tag "$text" "$tag"; then
      echo "$tag"
      found=0
    fi
  done
  return "$found"
}
