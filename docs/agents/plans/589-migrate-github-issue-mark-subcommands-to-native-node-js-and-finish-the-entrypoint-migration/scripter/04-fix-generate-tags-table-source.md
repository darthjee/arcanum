# Point generate_tags_table.sh at the cmd_mark_* source

`scripts/generate_tags_table.sh`'s `mark_tags_for_verb` finds the tags each `mark-<x>` call adds and removes by reading the `cmd_mark_<x>` function body from `LIB_GITHUB_ISSUE="${REPO_ROOT}/arcanum/_lib/github_issue.sh"`. Since #237 turned `github_issue.sh` into a thin dispatch shim, those functions live in `arcanum/_lib/github_issue_shell.sh`. The lookup finds nothing, so every `mark-*` row in `docs/agents/tag-mutations.md` shows `-` / `-`. For example, `discuss-issue | 2 (discuss_and_save.md)` should show `refined` / `created,idea,writting`.

Fix:
- Point `LIB_GITHUB_ISSUE` (consider renaming it to `LIB_GITHUB_ISSUE_MARKS`) at `arcanum/_lib/github_issue_shell.sh`, and update the two comments that name `github_issue.sh` as the source.
- Make the lookup fail loudly if the `cmd_mark_<x>` function isn't found for a `mark-<x>` verb, so a future move can't silently empty the table again. Print an error to stderr and exit non-zero. Check that `scripts/test_generate_tags_table.sh` still passes, and extend it if it has fixtures for this lookup.
- Regenerate `docs/agents/tag-mutations.md` with `scripts/generate_tags_table.sh` and commit it. Only the `mark-*` rows' added/removed columns should change.

## Files to Change
- `scripts/generate_tags_table.sh` — read `cmd_mark_*` from `github_issue_shell.sh`, and fail loudly on a missing function.
- `scripts/test_generate_tags_table.sh` — adjust or extend if affected.
- `docs/agents/tag-mutations.md` — regenerated.
