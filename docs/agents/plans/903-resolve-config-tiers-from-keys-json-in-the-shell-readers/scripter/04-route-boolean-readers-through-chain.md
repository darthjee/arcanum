# Route the boolean config readers through the chain

Implement the boolean-reader contract from [plan.md's Shared contracts](../plan.md#shared-contracts) for the get and is_enabled readers of both namespaces.

- Add a `_config_read_value <key>` helper to each `config_common.sh`, in `auto-fix-all/scripts` and `monitor-issues/scripts`. It sources `../../arcanum/_lib/config_chain.sh`, which brings in `key_registry.sh`. The helper:
  1. registered key (`key_registry_has_key "${NAMESPACE}.${key}"`): `config_chain_read "." "$NAMESPACE" "$key"`;
  2. unregistered key: `repo_config_read "$(_new_file_for_key "$key")" "" "$NAMESPACE" "$key"`, today's presence-checked direct read;
  3. still empty: `repo_config_read "" "$(_legacy_file_for_key "$key")" "$NAMESPACE" "$key"`, the legacy fallback with its warning. An empty legacy path reads nothing, as today.
- `config_get_shell.sh` and `config_is_enabled_shell.sh` in both folders call `_config_read_value "$KEY"` instead of `repo_config_read ...`. Their defaults stay the same: `false` for get, and only `true` enables.
- **Static scan.** The helper's `config_chain_read` / `repo_config_read` calls take variable arguments, so put `# config-key: <namespace>.<key>` annotations directly above them for every key that namespace's scripts read today:
  - `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `auto-fix-all.ignored_check_patterns`;
  - `monitor-issues.clear_context`.

  Keep or drop the existing annotations in the get/is_enabled scripts as `ShellConfigKeyScan_spec.js` requires. Run it to confirm.
- **Do not touch** `config_toggle_shell.sh` or `config_set_shell.sh` (#905).
- Update the `_new_file_for_key` / `_legacy_file_for_key` comments: registered keys now resolve their tier from keys.json, and `_new_file_for_key` is only used by the writers and for unregistered keys.

## Files to Change

- `auto-fix-all/scripts/config_common.sh`: add `_config_read_value`, source `config_chain.sh`, update the comments.
- `auto-fix-all/scripts/config_get_shell.sh`: use `_config_read_value`.
- `auto-fix-all/scripts/config_is_enabled_shell.sh`: use `_config_read_value`.
- `monitor-issues/scripts/config_common.sh`: add `_config_read_value`, source `config_chain.sh`, update the comments.
- `monitor-issues/scripts/config_get_shell.sh`: use `_config_read_value`.
- `monitor-issues/scripts/config_is_enabled_shell.sh`: use `_config_read_value`.
