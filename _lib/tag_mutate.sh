# Shared tag-mutation library for Arcanum skills.
#
# This file is meant to be SOURCED, not executed directly. It depends on
# _lib/tags.sh (extract_tags/has_tag) being sourced first.
#
# It exposes functions to add/remove a single tag (colon or emoji form)
# from a GitHub issue body's trailing `---`/`Tags:` block, plus a
# higher-level helper that fetches an issue's body, applies one of those
# mutations, and pushes the result back via `gh issue edit`. This
# generalizes the fetch -> mutate -> push sequence that used to live only
# in monitor-issues/scripts/github.sh's cmd_remove_tag, so other skills
# (e.g. auto-fix-all) can add/remove status tags without re-implementing
# the body-parsing logic.
#
# Guard against double-sourcing:
[[ -n "${_LIB_TAG_MUTATE_LOADED:-}" ]] && return 0
_LIB_TAG_MUTATE_LOADED=1

# _tag_mutate_emoji_for <tag>
#   Echoes the known emoji alias for canonical tag name <tag>, or nothing
#   if <tag> has no known emoji alias. Mirrors the emoji-alias table in
#   _lib/tags.sh's extract_tags — kept as a separate lookup here since this
#   file is about mutation, not extraction, but the two lists must be kept
#   in sync conceptually.
_tag_mutate_emoji_for() {
  case "$1" in
    question)    echo "❓" ;;
    pencil2)     echo "✏️" ;;
    clipboard)   echo "📋" ;;
    eyes)        echo "👀" ;;
    construction) echo "🚧" ;;
  esac
}

# tag_mutate_remove <body> <tag>
#   Removes the single <tag> token (colon or emoji form) from <body>'s
#   trailing `Tags:` line (case-insensitive). If the line becomes empty
#   after removal, drops the whole trailing `---`/`Tags:` block. Echoes
#   the resulting body to stdout. If <body> has no such block, or the
#   block doesn't contain <tag>, echoes <body> unchanged.
tag_mutate_remove() {
  local body="$1"
  local tag="$2"

  local emoji
  emoji=$(_tag_mutate_emoji_for "$tag")

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

# tag_mutate_add <body> <tag>
#   Adds the single <tag> token (`:tag:` colon form) to <body>'s trailing
#   `Tags:` line. If <body> already has <tag> (per has_tag), echoes <body>
#   unchanged. If a trailing `---`/`Tags:` block already exists, appends
#   `:tag:` to its `Tags:` line. If no such block exists yet, appends a
#   new one to the end of the body. Echoes the resulting body to stdout.
tag_mutate_add() {
  local body="$1"
  local tag="$2"

  if has_tag "$body" "$tag"; then
    echo "$body"
    return 0
  fi

  if perl -0777 -ne 'exit(/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+((?:(?i)tags:.*\n?)+)$/ ? 0 : 1)' <<< "$body"; then
    TAG_NAME="$tag" perl -0777 -pe '
      my $tag = $ENV{TAG_NAME};
      if (/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+((?:(?i)tags:.*\n?)+)$/) {
        my $block = $1;
        my $updated = $block;
        $updated =~ s/^((?i)tags:.*?)[ \t]*$/$1 :$tag:/m;
        my $quoted_block = quotemeta($block);
        s/$quoted_block/$updated/;
      }
    ' <<< "$body"
  else
    printf '%s\n\n---\n\nTags: :%s:\n' "$body" "$tag"
  fi
}

# tag_mutate_fetch_and_push <id> <repo_ref> <mutate_fn> <tag>
#   Fetches issue <id>'s body from <repo_ref> via `gh issue view`, applies
#   <mutate_fn> (either tag_mutate_add or tag_mutate_remove) with <tag>,
#   and pushes the result back via `gh issue edit --body-file`.
#
#   For tag_mutate_remove: if the tag is not present, prints a "nothing to
#   do" message and returns 0 without pushing.
#   For tag_mutate_add: if the tag is already present, prints a "nothing
#   to do" message and returns 0 without pushing.
#
#   On success, echoes a confirmation message naming the action (Added/
#   Removed) matching <mutate_fn>. On fetch/push failure, prints an
#   "Error: ..." message to stderr and returns 1 (does not exit, since
#   this is a sourced function — callers should propagate the exit code).
tag_mutate_fetch_and_push() {
  local id="$1"
  local repo_ref="$2"
  local mutate_fn="$3"
  local tag="$4"

  local body
  body=$(gh issue view "$id" -R "$repo_ref" --json body -q '.body' 2>/dev/null) || {
    echo "Error: could not fetch issue #$id from $repo_ref" >&2
    return 1
  }

  local verb
  if [[ "$mutate_fn" == "tag_mutate_remove" ]]; then
    verb="Removed"
    if ! has_tag "$body" "$tag"; then
      echo "Tag '$tag' not present on issue #$id — nothing to do."
      return 0
    fi
  elif [[ "$mutate_fn" == "tag_mutate_add" ]]; then
    verb="Added"
    if has_tag "$body" "$tag"; then
      echo "Tag '$tag' already present on issue #$id — nothing to do."
      return 0
    fi
  else
    echo "Error: unknown mutate function '$mutate_fn'" >&2
    return 1
  fi

  local new_body
  new_body=$("$mutate_fn" "$body" "$tag")

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
    return 1
  }

  rm -f "$tmpfile"
  echo "$verb tag '$tag' $([[ "$verb" == "Added" ]] && echo "to" || echo "from") issue #$id on $repo_ref"
}
