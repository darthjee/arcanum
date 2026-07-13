# Shared tag-mutation library for Arcanum skills.
#
# This file is meant to be SOURCED, not executed directly. It depends on
# _lib/tags.sh (has_tag, and the canonical-tag/label-name lookup) being
# sourced first.
#
# It exposes functions to add/remove a single canonical tag to/from a
# GitHub issue by mutating the issue's real GitHub labels directly via
# `gh issue edit --add-label`/`--remove-label`, resolving the label name
# from the canonical tag name via _lib/tags.sh's lookup table.
#
# Guard: `shipit` is human-only. Any attempt to add or remove it is
# refused with an error — no script may mutate the `shipit` label.
#
# Guard against double-sourcing:
[[ -n "${_LIB_TAG_MUTATE_LOADED:-}" ]] && return 0
_LIB_TAG_MUTATE_LOADED=1

# _tag_mutate_guard_shipit <tag>
#   Returns 1 (and prints an error to stderr) if <tag> is "shipit".
#   Returns 0 otherwise.
_tag_mutate_guard_shipit() {
  local tag="$1"
  if [[ "$tag" == "shipit" ]]; then
    echo "Error: shipit is human-only; scripts must not add or remove it" >&2
    return 1
  fi
  return 0
}

# tag_mutate_add_label <id> <repo_ref> <tag>
#   Adds the GitHub label mapped from canonical tag <tag> to issue <id> on
#   <repo_ref>, unless it is already present.
#
#   Refuses (returns 1) if <tag> is "shipit" — see the shipit guard above.
#   Fetches the issue's current labels via `gh issue view`; on fetch
#   failure prints "Error: could not fetch issue #$id from $repo_ref" to
#   stderr and returns 1.
#   If the label is already present, prints "Tag '$tag' already present on
#   issue #$id — nothing to do." and returns 0 without calling `gh`.
#   Otherwise adds the label via `gh issue edit --add-label`; on failure
#   prints "Error: could not update issue #$id on $repo_ref" to stderr and
#   returns 1; on success prints "Added tag '$tag' to issue #$id on
#   $repo_ref".
#
#   Does not exit — this is a sourced function, callers should propagate
#   the exit code themselves.
tag_mutate_add_label() {
  local id="$1"
  local repo_ref="$2"
  local tag="$3"

  _tag_mutate_guard_shipit "$tag" || return 1

  local label
  label=$(_tag_label_for "$tag")

  local labels
  labels=$(gh issue view "$id" -R "$repo_ref" --json labels -q '.labels[].name' 2>/dev/null) || {
    echo "Error: could not fetch issue #$id from $repo_ref" >&2
    return 1
  }

  if has_tag "$labels" "$tag"; then
    echo "Tag '$tag' already present on issue #$id — nothing to do."
    return 0
  fi

  gh issue edit "$id" -R "$repo_ref" --add-label "$label" >/dev/null || {
    echo "Error: could not update issue #$id on $repo_ref" >&2
    return 1
  }

  echo "Added tag '$tag' to issue #$id on $repo_ref"
}

# tag_mutate_remove_label <id> <repo_ref> <tag>
#   Removes the GitHub label mapped from canonical tag <tag> from issue
#   <id> on <repo_ref>, unless it is already absent.
#
#   Refuses (returns 1) if <tag> is "shipit" — see the shipit guard above.
#   Fetches the issue's current labels via `gh issue view`; on fetch
#   failure prints "Error: could not fetch issue #$id from $repo_ref" to
#   stderr and returns 1.
#   If the label is not present, prints "Tag '$tag' not present on issue
#   #$id — nothing to do." and returns 0 without calling `gh`.
#   Otherwise removes the label via `gh issue edit --remove-label`; on
#   failure prints "Error: could not update issue #$id on $repo_ref" to
#   stderr and returns 1; on success prints "Removed tag '$tag' from issue
#   #$id on $repo_ref".
#
#   Does not exit — this is a sourced function, callers should propagate
#   the exit code themselves.
tag_mutate_remove_label() {
  local id="$1"
  local repo_ref="$2"
  local tag="$3"

  _tag_mutate_guard_shipit "$tag" || return 1

  local label
  label=$(_tag_label_for "$tag")

  local labels
  labels=$(gh issue view "$id" -R "$repo_ref" --json labels -q '.labels[].name' 2>/dev/null) || {
    echo "Error: could not fetch issue #$id from $repo_ref" >&2
    return 1
  }

  if ! has_tag "$labels" "$tag"; then
    echo "Tag '$tag' not present on issue #$id — nothing to do."
    return 0
  fi

  gh issue edit "$id" -R "$repo_ref" --remove-label "$label" >/dev/null || {
    echo "Error: could not update issue #$id on $repo_ref" >&2
    return 1
  }

  echo "Removed tag '$tag' from issue #$id on $repo_ref"
}
