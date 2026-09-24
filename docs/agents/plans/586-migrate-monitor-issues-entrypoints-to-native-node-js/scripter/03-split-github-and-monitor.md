# Split github.sh and monitor_issues.sh

- `github.sh`: move `cmd_remove_tag` and its sourcing into `github_remove_tag_shell.sh`, which takes `<repo_path> <id> <tag>`. The shim keeps the usage block and, for `remove-tag`, calls `engine_dispatch "${2:-}" monitor-issues-github-remove-tag "${SCRIPT_DIR}/github_remove_tag_shell.sh" HOME -- "$@"` with the leading `remove-tag` shifted off. When `<repo_path>` is missing, keep today's usage error. Don't let `engine_dispatch` fail on an empty repo path first.
- `monitor_issues.sh`: move the whole current body to `monitor_issues_shell.sh`, unchanged. The shim validates `<repo_path>` with the same `${1:?Usage: ...}` message and calls `engine_dispatch "$REPO_PATH" monitor-issues-monitor-issues "${SCRIPT_DIR}/monitor_issues_shell.sh" HOME -- "$REPO_PATH"`. `monitor_issues_shell.sh` still finds `rewrite_queue.sh` through its own `SCRIPT_DIR`.
- Check signal handling as described in `scripter.md` Notes.

## Files to Change
- `monitor-issues/scripts/github.sh` — becomes the shim
- `monitor-issues/scripts/github_remove_tag_shell.sh` — new
- `monitor-issues/scripts/monitor_issues.sh` — becomes the shim
- `monitor-issues/scripts/monitor_issues_shell.sh` — new (today's body)
