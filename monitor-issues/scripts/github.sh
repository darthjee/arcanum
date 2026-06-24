#!/usr/bin/env bash
# GitHub operations script for monitor-issues
# Usage: github.sh <command> [args]
#   remove-tag <id> <tag>   Remove a single tag (colon or emoji form) from
#                           GitHub issue <id>'s trailing `Tags:` line, and
#                           push the updated body via `gh issue edit`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib_origin.sh
source "${SCRIPT_DIR}/_lib_origin.sh"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"

# strip_tag_from_body <body> <tag>
#   Removes the single <tag> token (colon or emoji form) from <body>'s
#   trailing `Tags:` line (case-insensitive). If the line becomes empty
#   after removal, drops the whole trailing `---`/`Tags:` block.
strip_tag_from_body() {
  local body="$1"
  local tag="$2"

  # Resolve the emoji alias (if any) for this canonical tag name, so both
  # forms can be matched/removed regardless of which one is in the body.
  local emoji=""
  case "$tag" in
    question)  emoji="❓" ;;
    pencil2)   emoji="✏️" ;;
    clipboard) emoji="📋" ;;
  esac

  TAG_NAME="$tag" TAG_EMOJI="$emoji" perl -0777 -pe '
    my $tag = $ENV{TAG_NAME};
    my $emoji = $ENV{TAG_EMOJI};
    if (/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+((?:(?i)tags:.*\n?)+)$/) {
      my $block = $1;
      my $stripped = $block;
      $stripped =~ s/:\Q$tag\E:\s*//gi;
      if (length($emoji)) {
        $stripped =~ s/\Q$emoji\E\s*//g;
      }
      # If only the "Tags:" label remains (no tokens left), drop the
      # whole trailing "---"/"Tags:" block; otherwise splice in the
      # stripped tag line in place of the original.
      if ($stripped =~ /^(?i)tags:\s*$/m) {
        s/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+(?:(?i)tags:.*\n?)+$//;
      } else {
        my $quoted_block = quotemeta($block);
        s/$quoted_block/$stripped/;
      }
    }
  ' <<< "$body"
}

cmd_remove_tag() {
  local id="${1:-}" tag="${2:-}"
  [[ -n "$id" && -n "$tag" ]] || {
    echo "Usage: $0 remove-tag <id> <tag>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  local body
  body=$(gh issue view "$id" -R "$repo_ref" --json body -q '.body' 2>/dev/null) || {
    echo "Error: could not fetch issue #$id from $repo_ref" >&2
    exit 1
  }

  if ! has_tag "$body" "$tag"; then
    echo "Tag '$tag' not present on issue #$id — nothing to do."
    return 0
  fi

  local new_body
  new_body=$(strip_tag_from_body "$body" "$tag")

  if [[ "$new_body" == "$body" ]]; then
    echo "Tag '$tag' not found in a trailing 'Tags:' block on issue #$id — nothing to do."
    return 0
  fi

  local tmpfile
  tmpfile=$(mktemp)
  printf '%s\n' "$new_body" > "$tmpfile"

  gh issue edit "$id" -R "$repo_ref" --body-file "$tmpfile" >/dev/null || {
    rm -f "$tmpfile"
    echo "Error: could not update issue #$id on $repo_ref" >&2
    exit 1
  }

  rm -f "$tmpfile"
  echo "Removed tag '$tag' from issue #$id on $repo_ref"
}

case "${1:-}" in
  remove-tag) shift; cmd_remove_tag "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  remove-tag <id> <tag>   Remove a single tag (colon or emoji form) from GitHub issue <id>'s trailing 'Tags:' line" >&2
    exit 1
    ;;
esac
