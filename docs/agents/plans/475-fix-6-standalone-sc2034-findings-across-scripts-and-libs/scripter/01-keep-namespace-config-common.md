# Keep NAMESPACE in config_common.sh, suppress with consumer comment

`NAMESPACE="auto-fix-all"` (line 13) is genuinely read — via `$NAMESPACE` — by 4 sourcing callers: `config_toggle_shell.sh`, `config_is_enabled_shell.sh`, `config_get_shell.sh`, and `config_set_shell.sh`, all of which call `repo_config_read`/`repo_config_write` with `"$NAMESPACE"` as an argument. ShellCheck flags it as unused because it never appears in `config_common.sh` itself. Add a `# shellcheck disable=SC2034` comment directly above the assignment naming the consumers, and leave the assignment and its value untouched.

## Files to Change

- `auto-fix-all/scripts/config_common.sh` — add `# shellcheck disable=SC2034 # consumed by config_{toggle,is_enabled,get,set}_shell.sh` immediately above the `NAMESPACE="auto-fix-all"` line (line 13).
