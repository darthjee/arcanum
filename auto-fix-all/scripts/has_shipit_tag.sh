#!/usr/bin/env bash
# Detect a "shipit" tag in an issue file's trailing tags line
# Usage: has_shipit_tag.sh <issue_file>
#   Reads <issue_file> (path relative to cwd, the target project root),
#   finds the LAST line matching ^[ \t]*tags: (case-insensitive), and
#   extracts every colon-delimited token on that line, e.g.
#   "tags: :shipit: :+1: :some_tag:" -> shipit, +1, some_tag
#   Exits 0 if any token equals "shipit" case-insensitively, else exit 1
#   (including when the file or the tags line doesn't exist).

set -euo pipefail

cmd_main() {
  local file="${1:-}"
  [[ -n "$file" ]] || { echo "Usage: $0 <issue_file>" >&2; exit 1; }
  [[ -f "$file" ]] || exit 1

  local tags_line
  tags_line=$(grep -iE '^[ \t]*tags:' "$file" | tail -n 1) || exit 1
  [[ -n "$tags_line" ]] || exit 1

  local tokens
  tokens=$(perl -ne '
    my @parts = split /:/, $_;
    shift @parts;
    for (my $i = 1; $i < @parts; $i += 2) {
      print "$parts[$i]\n" if defined $parts[$i] && $parts[$i] ne "";
    }
  ' <<< "$tags_line")
  [[ -n "$tokens" ]] || exit 1

  echo "$tokens" | grep -qiE '^shipit$'
}

cmd_main "$@"
