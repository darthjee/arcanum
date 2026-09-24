# Split config.sh

Follow the `auto-fix-all/scripts/config.sh` precedent from #261, but keep this script's cwd-relative CLI with no `repo_path`.

- Move today's per-subcommand bodies into `config_get_shell.sh`, `config_is_enabled_shell.sh`, `config_set_shell.sh` and `config_toggle_shell.sh`. Put the shared parts (`CONFIG_FILE`/`STATE_CONFIG_FILE`/`LOCK_FILE`, `_config_file_for_key`, `_read_config`, lock sourcing) in `config_common.sh`. Behaviour, messages and exit codes stay byte-for-byte the same.
- Rewrite `config.sh` as a shim. It validates the subcommand, prints the same usage line on stderr with exit 1 for unknown or missing ones, and then calls:
  `engine_dispatch "$PWD" monitor-issues-config-<sub> "${SCRIPT_DIR}/config_<sub>_shell.sh" --prepend-repo-path -- "$@"`
  Here `"$@"` is `<key> [<value>]`. The per-subcommand argument-count errors stay in the `*_shell.sh` files and are mirrored natively.

## Files to Change
- `monitor-issues/scripts/config.sh` — becomes the shim
- `monitor-issues/scripts/config_common.sh` — new, shared helpers
- `monitor-issues/scripts/config_{get,is_enabled,set,toggle}_shell.sh` — new
