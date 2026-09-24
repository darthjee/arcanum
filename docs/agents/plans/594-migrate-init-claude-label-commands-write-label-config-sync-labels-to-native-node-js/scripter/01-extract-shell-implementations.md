# Extract the shell implementations

Move the current logic of both scripts into `*_shell.sh` files, one per dispatched command name, following the `github_issue_*_shell.sh` precedent (#588/#589).

- `write_label_config_replace_shell.sh <config_path> <pair...>` → `label_config_write "$1" "${@:2}" || exit $?`. The same shape applies to `_remove_shell.sh` → `label_config_remove` and `_add_shell.sh` → `label_config_add`.
  - Each sources `lib/label_config.sh`.
  - The usage/arg validation stays in the shim, so these files assume valid arity.
  - Carry over the relevant part of today's `write_label_config.sh` header comment into each file.
- `sync_labels_shell.sh <repo_path> <config_path>` is today's `sync_labels.sh` body with two changes:
  1. `usage()` echoes the literal `Usage: sync_labels.sh <repo_path> [<config_path>]` instead of `$0`, so native can match it. Keep the second `config_path defaults to ...` line.
  2. `gh label list -R "$REPO" --limit 1000 --json name -q '.[].name'`, with a comment explaining the default 30-label cap (issue #594).
- Keep `set -euo pipefail`, the prompt loop, and the EOF error exactly as they are.

## Files to Change
- `init-claude/scripts/write_label_config_replace_shell.sh` — new
- `init-claude/scripts/write_label_config_remove_shell.sh` — new
- `init-claude/scripts/write_label_config_add_shell.sh` — new
- `init-claude/scripts/sync_labels_shell.sh` — new (moved body + two changes above)
