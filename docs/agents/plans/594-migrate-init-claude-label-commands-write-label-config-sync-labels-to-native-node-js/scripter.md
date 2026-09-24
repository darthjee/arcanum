# Scripter Plan: Migrate init-claude label commands (write-label-config, sync-labels) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- **Four shell impls:**
  - `init-claude/scripts/write_label_config_{replace,remove,add}_shell.sh <abs_config_path> <items...>`
  - `init-claude/scripts/sync_labels_shell.sh <repo_path> <abs_config_path>`
- **Two shims:**
  - `write_label_config.sh`: `engine_dispatch "$PWD" init-claude-write-label-config-<sub> ... --prepend-repo-path -- "$ABS_CONFIG_PATH" "$@"`, no env allowlist.
  - `sync_labels.sh`: `engine_dispatch "$REPO_PATH" init-claude-sync-labels ... HOME -- "$REPO_PATH" "$ABS_CONFIG_PATH"`, no `--prepend-repo-path`.
- The shims keep every argument/usage error. A `<config_path>` that doesn't start with `/` is prefixed with `$PWD/`. The sync-labels default is `.claude/state/init-claude-config.json`.
- `sync_labels_shell.sh`:
  - `usage()` prints the literal `Usage: sync_labels.sh <repo_path> [<config_path>]`.
  - `gh label list` gains `--limit 1000`.
  - Everything else stays byte-identical.
- `migration-status.json`: remove `init-claude-write-label-config`. Add `init-claude-write-label-config-replace`/`-remove`/`-add` as `true`. Set `init-claude-sync-labels` to `true`.

## Steps

- [01 — Extract the shell implementations](scripter/01-extract-shell-implementations.md)
- [02 — Rewrite both entrypoints as engine_dispatch shims](scripter/02-engine-dispatch-shims.md)
- [03 — Flip migration status and regenerate the status doc](scripter/03-flip-migration-status.md)

## CI Checks

- `init-claude/`, `arcanum/_lib/`: `shellcheck` on every touched `.sh` (CI shellcheck job)
- `docs/agents/architecture/entrypoint-migration-status.md`: `scripts/generate_entrypoint_migration_status.sh` must leave no diff

## Notes

- `lib/label_config.sh` stays, sourced by the shell impls. Nothing else in the repo sources it except `arcanum/migrations/repos/0.17.2/001.sh`, which has its own `gh label list` and is out of scope.
- The shims source only `engine_dispatch.sh`, not `label_config.sh`. Hardcode the default path literal in the `sync_labels.sh` shim with a comment pointing at `DEFAULT_LABEL_CONFIG_PATH`.
- Known, accepted divergence: `engine_dispatch` `cd`s into `<repo_path>` to read `engine.mode`. A non-existent `<repo_path>` therefore now fails before the table is printed, where before it failed after the prompt at `get_repo_ref`. Record this in the shim header.
