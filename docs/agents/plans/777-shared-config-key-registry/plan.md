# Plan: Shared config key registry

Issue: [777-shared-config-key-registry.md](../../issues/777-shared-config-key-registry.md)

## Overview

Implement the machine-readable registry of arcanum config keys exactly as specified in [`docs/agents/specs/arcanum-cli/key-registry.md`](../../specs/arcanum-cli/key-registry.md):

- `core/lib/utils/config/keys.json`, the data;
- `core/lib/utils/config/KeyRegistry.js`, the loader, matcher and validator;
- the specs that validate both;
- the three sync layers that keep the registry aligned with what arcanum reads: the defaults drift spec, the `ARCANUM_STRICT_CONFIG_KEYS` read guard and the shell static scan;
- the docs rule "adding a config key means adding a `keys.json` entry".

Nothing consumes the registry at runtime, so skill behaviour is unchanged.

## Agents involved

- [node](node.md): registry, `KeyRegistry.js`, strict guard, every spec, shared-surface allowlist entry.
- [scripter](scripter.md): `# config-key:` annotations on shell config calls whose key the static scan can't parse.
- [architect](architect.md): the docs-rule checklist items.

## Shared contracts

**Registry keys.** These are the spec's seed table minus one key, plus one key the spec missed:

| Key | Type | Tiers | Default |
| --- | --- | --- | --- |
| `engine.mode` | enum `shell`/`native`/`docker` | all | `shell` |
| `engine.log.location` | string | all | — |
| `git.email` | string | all | — |
| `git.agents.<agent>` | string | all | — |
| `git.safe_branch` | string | local | `origin/main` |
| `git.merge_body_mode` | enum `full`/`empty`/`coauthors` | all | `empty` |
| `git.omit_model_coauthor` | boolean | all | `false` |
| `git.remove_coauthors` | array of string | all | `[]` |
| `next_step.auto.<skill>` | boolean | all | `false` |
| `next_step.clear.<skill>` | boolean | all | `false` |
| `auto-fix-all.ignored_check_patterns` | array of string, `format: regex` | repo | `[]` |
| `auto-fix-all.clear_context` | boolean | local | `false` |
| `auto-fix-all.finish_on_empty_queue` | boolean | local | `false` |
| `plan-issues.max-retry-count` | number, integer, min 0 | all | `5` |
| `plan-issues.error-sleep-time` | number, integer, min 0 | all | `5` |
| `version` | string, read-only | repo | — |
| `migrations.version` | string, read-only | local | — |

- **Left out:** `monitor-issues.clear_context`. #776 adds it. If #776 has already merged by implementation time, add it here (boolean, local, `false`), or the sync specs will flag it.
- **Added:** `next_step.clear.<skill>`. It was introduced by #796 after the spec's seed audit. It is read by `arcanum/_lib/next_step_prompt_shell.sh` and `core/lib/commands/shared/NextStepPrompt.js`, and written by `init-claude-set-next-step-clear`. It has no `setup` entry.

**Shell annotation format** (node's scan reads it, scripter writes it):

- One or more consecutive `# config-key: <dotted.key>` lines sit directly above a `config_chain_read` / `repo_config_read` / `repo_config_write` / `global_config_read` / `global_config_write` call whose key can't be built statically.
- Each annotated key uses the registry's own `<name>` wildcard syntax, e.g. `# config-key: next_step.auto.<skill>`.
- Each annotated key must match a registry entry.
- When annotations are present they replace parsing for that call.

Parsing rules for the scan:

- `config_chain_read <repo> <ns> <key...>`: every `<key>` argument becomes `<ns>.<key>`.
- `repo_config_read|write <new_file> <legacy_file> <ns> <key> [...]`: the key is `<ns>.<key>`.
- `global_config_read|write <repo> <ns> <key> [...]`: the key is `<ns>.<key>`.
- A `${var}` / `$var` inside a key argument becomes one wildcard segment.
- A variable used as the whole namespace, or as a whole key argument, is unparseable and needs an annotation.
- The helper definitions in `arcanum/_lib/{config_chain,repo_config,global_config}.sh` are exempt.
- Comment lines are skipped.

## Dependencies

- **After #778.** Its explicit shared-surface allowlist in `core/eslint.config.mjs` must exist. If #778 has not merged when this is implemented, node stops at that step and reports it blocked rather than creating the allowlist itself.
- Independent of #776 (see above).
