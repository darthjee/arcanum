# Fix MD047 in ISSUE_TEMPLATE.md

`ISSUE_TEMPLATE.md` does not end with a trailing newline character (confirmed: the file's last byte is `.`, not `\n`). Add a single trailing newline at end of file — no other content change.

## Files to Change

- `ISSUE_TEMPLATE.md` — add a trailing newline character at end of file.
