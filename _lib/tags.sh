# Shared tag-parsing library for Arcanum skills.
#
# This file is meant to be SOURCED, not executed directly.
# It exposes two functions: extract_tags and has_tag.
#
# Tag state is backed by real GitHub issue labels, not free-form body text.
# Both functions take a newline-separated list of GitHub label names (e.g.
# the output of `gh issue view ... --json labels -q '.labels[].name'`) and
# map recognized label names to their canonical (colon-stripped) tag name
# via the table below. Unrecognized labels are silently ignored.
#
# Guard against double-sourcing:
[[ -n "${_LIB_TAGS_LOADED:-}" ]] && return 0
_LIB_TAGS_LOADED=1

# Canonical-tag <-> GitHub-label-name mapping (single source of truth).
#
#   Canonical tag   GitHub label
#   -------------   ------------
#   pencil2         Created
#   clipboard       Ready
#   shipit          shipit
#   construction    Working
#   question        Question
#   eyes            Fetched

# _tag_label_for <canonical_tag>
#   Echoes the GitHub label name for <canonical_tag>, or nothing if
#   <canonical_tag> is not recognized.
_tag_label_for() {
  case "$1" in
    pencil2)      echo "Created" ;;
    clipboard)    echo "Ready" ;;
    shipit)       echo "shipit" ;;
    construction) echo "Working" ;;
    question)     echo "Question" ;;
    eyes)         echo "Fetched" ;;
  esac
}

# _tag_for_label <label_name>
#   Echoes the canonical tag name for <label_name>, or nothing if
#   <label_name> is not recognized.
_tag_for_label() {
  case "$1" in
    Created)  echo "pencil2" ;;
    Ready)    echo "clipboard" ;;
    shipit)   echo "shipit" ;;
    Working)  echo "construction" ;;
    Question) echo "question" ;;
    Fetched)  echo "eyes" ;;
  esac
}

# extract_tags <labels_text>
#   Takes a newline-separated list of GitHub label names, maps each
#   recognized label to its canonical tag name via _tag_for_label, and
#   prints each unique canonical tag name on its own line. Unrecognized
#   labels (e.g. "Bug", "Feature", "Enqueued") are silently ignored.
#   Ordering follows first-occurrence order with duplicates suppressed.
extract_tags() {
  local labels_text="$1"
  local label tag
  while IFS= read -r label; do
    [[ -n "$label" ]] || continue
    tag=$(_tag_for_label "$label")
    [[ -n "$tag" ]] && echo "$tag"
  done <<< "$labels_text" | awk '!seen[$0]++' || true
}

# has_tag <labels_text> <tag>
#   Calls extract_tags on <labels_text> and checks whether <tag> appears in
#   the output (case-insensitive, full-line match).
#   Exits 0 if found, exits 1 if not found.
has_tag() {
  local labels_text="$1"
  local tag="$2"
  extract_tags "$labels_text" | grep -qi "^${tag}$"
}
