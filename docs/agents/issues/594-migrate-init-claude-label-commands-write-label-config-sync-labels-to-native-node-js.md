# Issue: Migrate init-claude label commands (write-label-config, sync-labels) to native Node.js

## Description

Sub-issue C of #585. Migrate the label-related `init-claude` entrypoints and their shared helper to native Node.js:

| Command | Script | Lines | Notes |
| --- | --- | --- | --- |
| `init-claude-write-label-config` | `init-claude/scripts/write_label_config.sh` | 76 | `replace`/`remove`/`add` subcommands; takes `<config_path>` only (no `<repo_path>`) |
| `init-claude-sync-labels` | `init-claude/scripts/sync_labels.sh` | 112 | `<repo_path> [<config_path>]`; interactive confirm (stdin) + GitHub label sync via `gh label list/create/edit` |

Shared helper: `init-claude/scripts/lib/label_config.sh` (241 lines — `validate_pair`, `write`, `ensure_defaults`, `read_pairs`, `remove`, `add`, plus `DEFAULT_LABEL_CONFIG_PATH` and the 22 `DEFAULT_LABEL_PAIRS`), used by both commands.

## Expected Behavior

Both entrypoints route through `engine_dispatch`, with stdout/stderr/exit codes identical in `engine.mode=native` and `shell`.

- `write_label_config.sh` becomes **three command names**, `init-claude-write-label-config-replace`, `-remove` and `-add`, each with its own shim branch and `*_shell.sh` implementation (following #261 and #588). In `migration-status.json`, the single `init-claude-write-label-config: false` key is replaced by three `true` keys.
- `init-claude-sync-labels` flips to `true`.

### Constraints

- `label_config.sh` is ported **once** as a shared native module (`services/` or `utils/`) used by both commands, including the default path and the default label table.
- `sync_labels.sh` reads a confirmation answer from stdin (`read -r answer`). The native version must keep the same prompt text (`Sync these labels to GitHub? [y/n]: `, no trailing newline), the re-prompt loop on unrecognized answers, and the EOF behavior (`Error: no input available for confirmation prompt` on stderr, exit 2), so the parity spec can drive it.
- Dispatch context differs per command:
  - `sync_labels.sh` already takes `<repo_path>` as `$1` (it resolves the GitHub repo from it) → `context: 'repo'`.
  - `write_label_config.sh` takes no `<repo_path>`; it follows the #593 precedent (`REPO_PATH="$PWD"` + `--prepend-repo-path`).
  - Native code never reads `process.cwd()`. Document the chosen context in each shim header.
- **Config path resolution:** both shims turn the `<config_path>` argument into an absolute path under `$PWD` before dispatching. For sync-labels this also covers the default `.claude/state/init-claude-config.json` when no path is given. Paths that are already absolute pass through unchanged. Both modes then read and write the same file, and native code never depends on cwd. The shell implementation's usage/error text still names the default path as before.
- `GitHubClient` currently has no label operations. Add list (paginated), create, and update/rename label methods rather than shelling out to `gh`. Keep the case-insensitive matching of existing names, and the rename-to-configured-case on update.
- **Label-list cap fix (intentional behavior change, applied to both modes):** `gh label list` returns only 30 labels by default. On a repo with more labels, an existing label beyond the first 30 goes unmatched, and `gh label create` then fails on the name collision. The native client paginates through all labels, and the shell implementation adds `--limit 1000` to `gh label list` so both modes still match.

## Solution

Follow `docs/agents/architecture/script-engine.md` and the precedent of #588 (per-command `*_shell.sh` + thin `engine_dispatch` shim), #261 (multi-subcommand split) and #593 (cwd-based command without `<repo_path>`).

1. Read each source script for its exact stdout/stderr/exit-code contract.
2. **scripter:** move each implementation into a `*_shell.sh` file and make the original script a thin `engine_dispatch` shim with a minimal per-command env-var allowlist (`HOME` only for sync-labels, where `gh auth token` is needed). Argument/usage errors stay in the shim so they are identical in both modes.
3. **node:** implement the native commands under `core/lib/commands/init-claude/` with zero runtime deps. Reuse the existing `services/`/`utils/` modules (e.g. `utils/config/RepoConfig.js`, `GitHubClient`) instead of re-deriving them. Add the label methods to the GitHub client layer.
4. Register each command in `core/lib/core/commands.js`.
5. In `arcanum/_lib/migration-status.json`, replace the relevant `false` key(s) with one `true` key per dispatched command name, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
6. Add native unit specs mirroring `core/lib/` 1:1, plus a shell-vs-native parity spec per command.
7. Verify `engine_dispatch.sh` routing under both `engine.mode=native` and `shell`.
8. Fix the stale label count in `init-claude/setup_labels.md` ("standard 9 labels"; there are now 22 defaults).
