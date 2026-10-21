# Route the shell config scripts through repo_config

Rewrite `monitor-issues/scripts/config_common.sh` to follow `auto-fix-all/scripts/config_common.sh`:

- Set `CONFIG_FILE=".claude/configuration/monitor-issues.json"` (the legacy file), `NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"`, `NEW_STATE_FILE=".claude/state/arcanum-config.json"` and `NAMESPACE="monitor-issues"`.
- Source `arcanum/_lib/repo_config.sh`, which brings in `lock.sh`, instead of `lock.sh` directly.
- Add `_new_file_for_key` (`clear_context` → `$NEW_STATE_FILE`, otherwise `$NEW_CONFIG_FILE`) and `_legacy_file_for_key` (`clear_context` → `""`, otherwise `$CONFIG_FILE`). Remove `_config_file_for_key`, `_read_config`, `STATE_CONFIG_FILE` and `LOCK_FILE`.
- Keep the `mkdir -p .claude/state` only if `repo_config_write` doesn't already create the parent directory. Check before removing it.
- Update the header comment to describe the new layout.

Then update `config_get_shell.sh`, `config_is_enabled_shell.sh`, `config_set_shell.sh` and `config_toggle_shell.sh` to mirror their `auto-fix-all` counterparts, without the `repo_path_enter`/`<repo_path>` argument. Keys stay at `$1`/`$2`. Read with `repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY"`, defaulting to `false`. Write with `repo_config_write ...` (no explicit `_acquire_lock`/`_release_lock`). Put `# config-key: monitor-issues.clear_context` directly above each helper call.

## Files to Change

- `monitor-issues/scripts/config_common.sh`: new/legacy routing, `NAMESPACE`, source `repo_config.sh`
- `monitor-issues/scripts/config_get_shell.sh`: `repo_config_read`
- `monitor-issues/scripts/config_is_enabled_shell.sh`: `repo_config_read`
- `monitor-issues/scripts/config_set_shell.sh`: `repo_config_write`
- `monitor-issues/scripts/config_toggle_shell.sh`: `repo_config_read` + `repo_config_write`
- `monitor-issues/scripts/config.sh`: header comment only, if it mentions the old files
