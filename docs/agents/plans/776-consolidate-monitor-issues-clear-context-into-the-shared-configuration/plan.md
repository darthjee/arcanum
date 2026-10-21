# Plan: Consolidate monitor-issues clear_context into the shared configuration

Issue: [776-consolidate-monitor-issues-clear-context-into-the-shared-configuration.md](../../issues/776-consolidate-monitor-issues-clear-context-into-the-shared-configuration.md)

## Overview

This moves `monitor-issues`' config layout onto the same namespaced, three-tier files that `auto-fix-all` already uses. `clear_context` becomes `.monitor-issues.clear_context` in `.claude/state/arcanum-config.json`, with no legacy read fallback. Every other key goes under `.monitor-issues.<key>` in `.claude/configuration/arcanum-repo-config.json`, with `.claude/configuration/monitor-issues.json` as the legacy read/seed fallback. `scripter` reworks the shell engine, adds a non-skippable local migration that carries existing values forward, and updates the docs. `node` reworks `MonitorIssuesConfig.js`, registers the key, and updates the specs. The `config.sh` CLI stays cwd-relative and doesn't change, so `monitor-issues/SKILL.md` and `/toggle-monitor-clear-context` need no edits.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

**Namespace:** `monitor-issues`.

**Key → file routing** (shell `_new_file_for_key` / `_legacy_file_for_key`, native `_newFileForKey` / `_legacyFileForKey`):

| Key | New file (read/write) | Legacy file |
| --- | --- | --- |
| `clear_context` | `.claude/state/arcanum-config.json` | none (shell `""`, native `null`): no read fallback, no write-time seed |
| any other key | `.claude/configuration/arcanum-repo-config.json` | `.claude/configuration/monitor-issues.json` (read fallback with the standard `repo_config_read` warning, plus a write-time namespace seed) |

All paths resolve relative to the cwd. `config.sh` keeps passing `$PWD` through `--prepend-repo-path`. The `config_*_shell.sh` scripts keep their plain `<key> [<value>]` CLI, with no `<repo_path>` argument.

**Stored shape:** `{"monitor-issues": {"clear_context": true|false}}`. Values are JSON booleans, and other top-level keys in the file are preserved.

**Subcommand semantics** match `auto-fix-all` exactly (`repo_config_read` / `repo_config_write`, and natively `BooleanKeyConfig` + the `AutoFixAllConfig` read/build logic):

- `get <key>`: prints the value `jq -c`-compact (`true`/`false` for booleans), or `false` when it is absent everywhere. Exit 0.
- `is-enabled <key>`: exit 0 iff the value is `true`.
- `set <key> true|false`: writes and prints nothing. Any other value gives `Error: value must be 'true' or 'false'` and exit 1.
- `toggle <key>`: flips the value (absent counts as `false`) and prints the new value.
- The argument-count error messages stay as they are today (`Error: get requires a key`, etc.).

**Locking:** writes lock `<new file>.lock` (e.g. `.claude/state/arcanum-config.json.lock`), the same lock `repo_config_write` uses. `.claude/state/monitor-issues-config.lock` is no longer used.

**Migration:** `arcanum/migrations/repos/next/001.sh` + `001.md`, registered in `arcanum/migrations/repos/next/migrations.json` as `{"id": "001", "type": "script", "file": "001.sh", "skippable": false, "applies_to": "local"}`. `001.sh config` prints `{"skippable": false}`. `001.sh run` calls `repo_config_seed .claude/state/arcanum-config.json .claude/state/monitor-issues-config.json monitor-issues`. It is idempotent: a no-op when the `monitor-issues` namespace already exists or the legacy file is absent. It never deletes the legacy file or the old lock. No repo-scoped migration is added, because the other keys keep their read fallback and write-time seed. (If `next/` already holds entries when work starts, take the next free id and update every reference to it.)

**Registry entry** (`core/lib/utils/config/keys.json`): `{"key": "monitor-issues.clear_context", "type": "boolean", "tiers": ["local"], "default": false, "description": "Clear the context between monitor-issues polling cycles"}`. It has no `setup` entry.

**Shell annotations:** every `repo_config_read`/`repo_config_write` call in `monitor-issues/scripts/config_*_shell.sh` carries `# config-key: monitor-issues.clear_context` on the line directly above it, so the #777 static scan (`core/spec/support/utils/shellConfigKeys.js`) resolves the variable key to the registered key.
