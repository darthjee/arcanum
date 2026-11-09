# monitor-issues config scripts

Do the same for monitor-issues.

- **`config_common.sh`:**
  - Delete `CONFIG_FILE` (`.claude/configuration/monitor-issues.json`) and `_legacy_file_for_key`.
  - Drop the legacy step from `_config_read_value`, and fix the comments.
  - Keep the note that `clear_context`'s old `.claude/state/monitor-issues-config.json` value was carried forward by a migration.
- **`config_set_shell.sh` / `config_toggle_shell.sh`:** pass `""` as `<legacy_file>` to `repo_config_write`, and to the toggle's `repo_config_read`.

## Files to Change

- `monitor-issues/scripts/config_common.sh`: remove `CONFIG_FILE`, `_legacy_file_for_key` and the legacy read step, and update the comments.
- `monitor-issues/scripts/config_set_shell.sh`: pass `""` as `<legacy_file>`.
- `monitor-issues/scripts/config_toggle_shell.sh`: pass `""` as `<legacy_file>` to both the read and the write.
