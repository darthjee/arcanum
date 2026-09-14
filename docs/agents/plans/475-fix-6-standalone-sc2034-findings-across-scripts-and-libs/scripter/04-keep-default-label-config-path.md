# Keep DEFAULT_LABEL_CONFIG_PATH in label_config.sh, suppress with consumer comment

`DEFAULT_LABEL_CONFIG_PATH=".claude/state/init-claude-config.json"` (line 67) is read via `$DEFAULT_LABEL_CONFIG_PATH` by `init-claude/scripts/sync_labels.sh`, both in its usage/help text (`echo "  config_path defaults to ${DEFAULT_LABEL_CONFIG_PATH}"`) and as the default for its `CONFIG_PATH` variable (`CONFIG_PATH="${2:-$DEFAULT_LABEL_CONFIG_PATH}"`). Add a `# shellcheck disable=SC2034` comment above the assignment naming that consumer, and leave the assignment untouched.

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `# shellcheck disable=SC2034 # consumed by sync_labels.sh` immediately above the `DEFAULT_LABEL_CONFIG_PATH=".claude/state/init-claude-config.json"` line (line 67).
