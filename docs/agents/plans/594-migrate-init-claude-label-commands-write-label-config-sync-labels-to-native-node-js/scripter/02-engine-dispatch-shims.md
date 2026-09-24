# Rewrite both entrypoints as engine_dispatch shims

Follow `init-claude/scripts/setup_docs_structure.sh` (#593) for the header style and `arcanum/_lib/github_issue.sh` for the per-subcommand `case`.

`write_label_config.sh`:
- Keep the whole current usage header and `usage()` function, which still uses `$0`, since the shim is the invoked script.
- Keep the subcommand/`CONFIG_PATH`/`$# -ge 1` guards unchanged, exit 2.
- Make `CONFIG_PATH` absolute against `$PWD`, `shift` it off, then run `engine_dispatch "$PWD" "init-claude-write-label-config-${SUBCOMMAND}" "${SCRIPT_DIR}/write_label_config_${SUBCOMMAND}_shell.sh" --prepend-repo-path -- "$ABS_CONFIG_PATH" "$@"`.
- In the header, document the context choice: literal `$PWD` as repo_path (not `git rev-parse`), plus `--prepend-repo-path`, as in #593.

`sync_labels.sh`:
- Keep `REPO_PATH="${1:?Usage: $0 <repo_path> [<config_path>]}"` verbatim, so the missing-arg message and exit code are unchanged.
- Default `CONFIG_PATH` to `.claude/state/init-claude-config.json`, make it absolute against `$PWD`, then run `engine_dispatch "$REPO_PATH" init-claude-sync-labels "${SCRIPT_DIR}/sync_labels_shell.sh" HOME -- "$REPO_PATH" "$ABS_CONFIG_PATH"`.
- In the header, document:
  - `context: 'repo'` from the existing `<repo_path>` positional.
  - The `HOME` allowlist, which `gh auth token` needs.
  - That stdin passes through to both implementations.
  - The config-path absolutization.
  - The accepted non-existent-`<repo_path>` divergence.

## Files to Change
- `init-claude/scripts/write_label_config.sh` — thin shim
- `init-claude/scripts/sync_labels.sh` — thin shim
