# Fix MD012 in README.md

`README.md` has two consecutive blank lines (lines 4-5) between the intro paragraph and the badge links, where markdownlint expects exactly one. Delete one of the two blank lines so the intro paragraph is followed by a single blank line, then the badges.

## Files to Change

- `README.md` — collapse the two consecutive blank lines at lines 4-5 into one.
