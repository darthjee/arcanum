# Plan: Migrate init-claude label commands (write-label-config, sync-labels) to native Node.js

Issue: [594-migrate-init-claude-label-commands-write-label-config-sync-labels-to-native-node-js.md](../../issues/594-migrate-init-claude-label-commands-write-label-config-sync-labels-to-native-node-js.md)

## Overview

Turn `init-claude/scripts/write_label_config.sh` and `init-claude/scripts/sync_labels.sh` into thin `engine_dispatch` shims. `write_label_config.sh` becomes three command names (`-replace`/`-remove`/`-add`), following #261/#589. `sync_labels.sh` becomes `init-claude-sync-labels`. Each shim has a matching `*_shell.sh` implementation and a native command under `core/lib/commands/init-claude/`. `lib/label_config.sh` is ported once to a native `services/LabelConfig.js`. The GitHub client layer gains label list (paginated), create, and update methods. Two intentional behavior changes apply to both modes: both shims make the config path absolute against `$PWD`, and `gh label list` gains `--limit 1000`.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [skill-writer](skill-writer.md)

## Shared contracts

### Command names (`migration-status.json` / `core/lib/core/commands.js` keys)

| Command | Shell impl | Native module / method | Registry entry |
| --- | --- | --- | --- |
| `init-claude-write-label-config-replace` | `init-claude/scripts/write_label_config_replace_shell.sh` | `commands/init-claude/InitClaudeWriteLabelConfig.js` / `replace` | `context: 'repo'`, `validateRepoPath: false` |
| `init-claude-write-label-config-remove` | `init-claude/scripts/write_label_config_remove_shell.sh` | same module / `remove` | same |
| `init-claude-write-label-config-add` | `init-claude/scripts/write_label_config_add_shell.sh` | same module / `add` | same |
| `init-claude-sync-labels` | `init-claude/scripts/sync_labels_shell.sh` | `commands/init-claude/InitClaudeSyncLabels.js` / `run` | `context: 'repo'`, `validateRepoPath: false` |

In `arcanum/_lib/migration-status.json`, the key `init-claude-write-label-config` is **removed** and the three `-replace`/`-remove`/`-add` keys are added as `true`. `init-claude-sync-labels` flips to `true`.

### Argument shapes (after the shim)

`write_label_config.sh <replace|remove|add> <config_path> <items...>`:
- The shim keeps **all** existing usage validation: unknown or missing subcommand, empty `<config_path>`, or no items → the existing `usage()` block on stderr, exit 2. None of these reach `engine_dispatch`.
- The shim makes `<config_path>` absolute: `ABS_CONFIG_PATH="$CONFIG_PATH"` when it starts with `/`, else `"$PWD/$CONFIG_PATH"`.
- Dispatch: `engine_dispatch "$PWD" init-claude-write-label-config-<sub> "${SCRIPT_DIR}/write_label_config_<sub>_shell.sh" --prepend-repo-path -- "$ABS_CONFIG_PATH" "$@"`. There is no env allowlist.
- The shell impl receives `<abs_config_path> <items...>`. Native receives `<repoPath=$PWD> <abs_config_path> <items...>`. The `RepoContext` strips `repoPath`, so the native method gets `(configPath, ...items)`.

`sync_labels.sh <repo_path> [<config_path>]`:
- The shim keeps `REPO_PATH="${1:?Usage: $0 <repo_path> [<config_path>]}"` exactly as today, so the missing-arg message and exit code do not change.
- `CONFIG_PATH="${2:-.claude/state/init-claude-config.json}"`, made absolute against `$PWD` the same way as above.
- Dispatch: `engine_dispatch "$REPO_PATH" init-claude-sync-labels "${SCRIPT_DIR}/sync_labels_shell.sh" HOME -- "$REPO_PATH" "$ABS_CONFIG_PATH"`. There is **no** `--prepend-repo-path`, because `repo_path` is already the leading positional.
- Native receives `<repoPath> <abs_config_path>`, so its method gets `(configPath)`.
- Native code never reads `process.cwd()`. When a relative `configPath` does arrive (direct native call), it is resolved with `path.resolve(context.repoPath, configPath)`.

### Config JSON format (both modes, byte-identical)

`{"labels":[{"name":..,"color":..}]}` rendered like `jq`'s default pretty-print, i.e. `JSON.stringify(obj, null, 2) + '\n'`. An empty array renders as `"labels": []`. The write is atomic: `<path>.tmp`, then rename. Parent dirs are created.

`read_pairs` / `ensure_defaults` treat a file as empty in these cases: missing, zero-size, unparseable JSON, or `.labels` missing/null/empty. `ensure_defaults` then writes the 22 `DEFAULT_LABEL_PAIRS`, in `lib/label_config.sh`'s order. Each pair splits on the **first** `:`: name = before it, color = the rest.

### Messages / exit codes (stdout + exit code must be byte-identical; stderr text identical, native adds no `arcanum:` prefix on these paths)

- Invalid pair (`replace`/`add`): stderr is one of three `label_config_validate_pair` messages, then exit 2 with the file untouched:
  - `Error: invalid pair '<p>' — expected <label name>:<hex color>`
  - `Error: invalid pair '<p>' — label name is empty`
  - `Error: invalid color '<c>' for label '<n>' — expected exactly 6 hex digits`
- `remove` with a `:`-containing name: stderr `Error: invalid label name '<n>' — remove takes bare names, not <name>:<color> pairs`, exit 2.
- Success for write-label-config: no output, exit 0.
- sync-labels, invalid pair in the config: the validate-pair error line, then the usage block. The shell impl's `usage()` now prints the **literal** `Usage: sync_labels.sh <repo_path> [<config_path>]` (not `$0`, which would now be `sync_labels_shell.sh`), then `  config_path defaults to .claude/state/init-claude-config.json`. Exit 2.
- sync-labels stdout: `| Label | Color |`, `| --- | --- |`, one `| <name> | #<color> |` per label, then the prompt `Sync these labels to GitHub? [y/n]: ` with no newline. The prompt repeats for each unrecognized line.
- Answer matching: `read -r` semantics. Leading and trailing spaces/tabs are trimmed, then lowercased. `y`/`yes` → sync. `n`/`no` → `STATUS=discuss\n`, exit 1. Anything else → re-prompt. EOF before a **newline-terminated** line (including a final unterminated line) → stderr `Error: no input available for confirmation prompt`, exit 2.
- On yes: stdout `STATUS=synced`, then one `UPDATED=<name>` or `CREATED=<name>` line per label, in config order, exit 0.
  - A label counts as existing when its name matches case-insensitively. Update renames it to the configured case and sets its color.
  - Repo-resolution or GitHub failure after the prompt: non-zero exit. Parity compares only stdout and exit code there, since the shell side's stderr comes from `gh` or origin.

Native emits every error message on these paths with `process.stderr.write` and throws `DispatchFailure(<stdout>, <code>)`. The table and prompt are streamed to `process.stdout` **before** stdin is read, not returned as a string.

### GitHub label listing

- Shell: `gh label list -R "$REPO" --limit 1000 --json name -q '.[].name'`.
- Native: `GET /repos/<repo>/labels?per_page=100&page=N` until a short page.
- Create: `POST /repos/<repo>/labels {name, color}`.
- Update: `PATCH /repos/<repo>/labels/<encodeURIComponent(existingName)> {new_name, color}`.

## Execution order

1. node (services, client, commands, registry, specs). The native specs can run against the `*_shell.sh` files, so scripter's step 01 should land first or together with it.
2. scripter: 01 shell impls, 02 shims, 03 migration-status flip + regenerated doc, last.
3. skill-writer: one doc fix, independent.
