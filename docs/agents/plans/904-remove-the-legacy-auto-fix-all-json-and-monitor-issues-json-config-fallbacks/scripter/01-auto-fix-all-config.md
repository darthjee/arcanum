# auto-fix-all config scripts

Remove the legacy fallback from auto-fix-all's shell config scripts.

- **`config_common.sh`:**
  - Delete `CONFIG_FILE` and `_legacy_file_for_key`.
  - In `_config_read_value`, drop step 3 (the `[[ -z "$value" ]]` legacy block and its warning).
  - Update the header comments so they describe two steps (chain for registered keys, direct new-file read for unregistered keys).
- **`config_set_shell.sh`:** `repo_config_write "$(_new_file_for_key "$KEY")" "" "$NAMESPACE" "$KEY" "$VALUE"`.
- **`config_toggle_shell.sh`:**
  - Both the read-before-flip `repo_config_read` and the `repo_config_write` pass `""` as the legacy file.
  - The read stays a direct new-file read; moving it onto the chain belongs to #905.

## Files to Change

- `auto-fix-all/scripts/config_common.sh`: remove `CONFIG_FILE`, `_legacy_file_for_key` and the legacy step of `_config_read_value`, and update the comments.
- `auto-fix-all/scripts/config_set_shell.sh`: pass `""` as `<legacy_file>`.
- `auto-fix-all/scripts/config_toggle_shell.sh`: pass `""` as `<legacy_file>` to both the read and the write.
