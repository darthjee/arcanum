# Plan: Auto-next: init-claude, migrations, remove spec

Issue: [716-auto-next-init-claude-migrations-remove-spec.md](../../issues/716-auto-next-init-claude-migrations-remove-spec.md)

## Overview

This plan adds the two ways to turn on the `next_step.auto.<skill>` keys, and then retires the spec. The first way is a new init-claude step that writes the keys to repo config. The second is three skippable `/arcanum-migrate` migrations in `arcanum/migrations/repos/next/` (local, repo and global). Neither the shell config writers nor the native ones support dotted keys today: `repo_config_write`, `global_config_write` and `RepoConfigWriter` all do `.[ns][key] = v`. Without that support, `auto.<skill>` would be written as a literal key, so both writers gain dotted-key support first, to match the readers. Once the feature is complete, `docs/agents/specs/skill-auto-next.md` is deleted and its remaining rules move into the architecture docs.

## Agents involved

- [scripter](scripter.md): dotted-key support in the shell writers, and the three migrations.
- [node](node.md): dotted-key support in `RepoConfigWriter`, the native-only `init-claude-set-next-step-auto` command, and the specs.
- [skill-writer](skill-writer.md): the new init-claude step.
- [architect](architect.md): the architecture docs, the guides and README, and deleting the spec.

## Shared contracts

### Dotted keys in the config writers

- `repo_config_write <file> <legacy_file> <namespace> <key> <json_value>` (`arcanum/_lib/repo_config.sh`) and `global_config_write <repo_path> <namespace> <key> <json_value>` (`arcanum/_lib/global_config.sh`) treat `<key>` as a dot-separated path. They write it with `setpath(($k | split(".")); $v)` under `.[$ns]`, creating any missing intermediate objects. This mirrors `repo_config_read`/`global_config_read`, which already resolve dotted keys with `getpath`.
- A flat key (no dot) behaves exactly as it does today.
- Example: `repo_config_write .claude/configuration/arcanum-repo-config.json "" next_step auto.enhance-issue true` yields `{"next_step":{"auto":{"enhance-issue":true}}}` and keeps any sibling keys already under `next_step.auto`.
- The native `RepoConfigWriter.write({ newFile, legacyFile, namespace, key, value })` (`core/lib/utils/config/RepoConfigWriter.js`) follows the same rule: a dotted `key` is a nested path, and a flat key is unchanged.

### Keys and values

- The skills, in prompt and table order, are `enhance-issue`, `discuss-issue` and `auto-plan-issue`.
- Namespace `next_step`, key `auto.<skill>`, JSON value `true` or `false`.
- "Skip" or "unset" means nothing is written. There is no delete.

### Native-only command `init-claude-set-next-step-auto`

- Shim: `init-claude/scripts/set_next_step_auto.sh <repo_path> <skill> <true|false>`, dispatched with `engine_dispatch --native-only`, the same way as `arcanum-check-config/scripts/*.sh`. It has no `*_shell.sh` twin and no entry in `migration-status.json`.
- Native command: `core/lib/commands/init-claude/InitClaudeSetNextStepAuto.js`.
- It writes `next_step.auto.<skill>` = `true|false` into `<repo_path>/.claude/configuration/arcanum-repo-config.json`, creating the file and folder if needed, through `RepoConfigWriter`.
- Success: it prints `NEXT_STEP_AUTO=<skill>=<true|false>` on stdout and exits `0`.
- Usage errors exit `1` with a message on stderr. They cover a missing argument, a `<skill>` outside the three above, and a value other than `true` or `false`.

### Migrations (`arcanum/migrations/repos/next/`)

`next/` is empty (`[]`), so the ids are `001`, `002` and `003`. Each is `type: script` and `skippable: true`:

| id | `applies_to` | Writes to | Writer |
| --- | --- | --- | --- |
| `001` | `local` | `.claude/state/arcanum-config.json` | `repo_config_write` |
| `002` | `repo` | `.claude/configuration/arcanum-repo-config.json` (prints a "this will be committed and visible to all contributors" warning first) | `repo_config_write` |
| `003` | `global` | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | `global_config_write` |

- `NNN.sh config` prints `{"skippable": true}`.
- `NNN.sh run`, when `/dev/tty` cannot be opened, returns `0` and writes nothing. Otherwise it prompts once per key, in the order above, with `[Y]es/[N]o/[S]kip`: `Y` writes `true`, `N` writes `false`, and anything else writes nothing.
- Before the first key, it explains that an explicit `false` shadows a `true` set in a lower-precedence tier (the chain is local → repo → global).
