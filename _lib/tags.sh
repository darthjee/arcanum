# Shared tag-parsing library for Arcanum skills.
#
# This file is meant to be SOURCED, not executed directly.
# It exposes two functions: extract_tags and has_tag.
#
# Guard against double-sourcing:
[[ -n "${_LIB_TAGS_LOADED:-}" ]] && return 0
_LIB_TAGS_LOADED=1

# extract_tags <text>
#   Scans <text> for all occurrences of the pattern `:word:` where word is
#   [A-Za-z0-9_+]+, strips the surrounding colons, and prints each unique
#   tag name on its own line. Also recognizes a small set of emoji aliases
#   (see _TAG_EMOJI_ALIASES below) as equivalent to their canonical `:word:`
#   name, so a tag may be written either way in the source text and still
#   normalize to the same bare name. Extraction is case-sensitive for the
#   `:word:` form; ordering follows first-occurrence order with duplicates
#   suppressed.
#
# Emoji aliases (emoji -> canonical name):
#   ❓  -> question
#   ✏️  -> pencil2
#   📋  -> clipboard
#   👀  -> eyes
#   🚧  -> construction
extract_tags() {
  local text="$1"
  local normalized="$text"
  # Replace each known emoji alias with its canonical `:word:` form before
  # running the colon-based extraction, so both forms feed the same path.
  normalized="${normalized//❓/:question:}"
  normalized="${normalized//✏️/:pencil2:}"
  normalized="${normalized//📋/:clipboard:}"
  normalized="${normalized//👀/:eyes:}"
  normalized="${normalized//🚧/:construction:}"
  echo "$normalized" | grep -oE ':[A-Za-z0-9_+]+:' | sed 's/^://;s/:$//' | awk '!seen[$0]++'
}

# has_tag <text> <tag>
#   Calls extract_tags on <text> and checks whether <tag> appears in the
#   output (case-insensitive, full-line match).
#   Exits 0 if found, exits 1 if not found.
has_tag() {
  local text="$1"
  local tag="$2"
  extract_tags "$text" | grep -qi "^${tag}$"
}
