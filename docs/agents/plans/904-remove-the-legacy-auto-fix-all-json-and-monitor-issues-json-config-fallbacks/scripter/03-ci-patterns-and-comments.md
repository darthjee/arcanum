# set_ci_ignored_patterns and comments

- **`init-claude/scripts/set_ci_ignored_patterns_shell.sh`:**
  - Delete `LEGACY_CONFIG_FILE`.
  - Call `repo_config_write "$NEW_CONFIG_FILE" "" "$NAMESPACE" "ignored_check_patterns" "$PATTERNS_JSON"`.
  - Rewrite the header comment: the script writes the namespaced file only, and never reads or seeds from `auto-fix-all.json`.
- **Comment-only updates:**
  - `auto-fix-all/scripts/wait_ci_shell.sh`: simplify the "No legacy … fallback is attempted" sentence. Nothing reads that file any more.
  - `arcanum/_lib/repo_config.sh` header: describe `<legacy_file>` as an optional seed/fallback used by migrations, rather than naming `auto-fix-all.json` as a live fallback.
  - Leave the function bodies unchanged.

## Files to Change

- `init-claude/scripts/set_ci_ignored_patterns_shell.sh`: drop `LEGACY_CONFIG_FILE`, pass `""`, and update the comment.
- `auto-fix-all/scripts/wait_ci_shell.sh`: comment only.
- `arcanum/_lib/repo_config.sh`: header comment only.
