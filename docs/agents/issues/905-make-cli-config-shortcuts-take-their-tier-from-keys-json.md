# Issue: Make CLI config shortcuts take their tier from keys.json

## Description

Part of #900 (split from the original sub-issue 2). Depends on #902 (done); works with #907 (tier review).

Every place that writes a config key picks its target tier from a hardcoded value instead of from `shared/lib/config/keys.json`:

- **CLI shortcuts** (`cli/lib/commands/config/shortcuts/`): `SINGLE_VALUE` in `singleValue.js` sets `tier: 'local'` on every entry, `nextStep.js` has `DEFAULT_TIER = 'local'`, `agentsEmailRead.js` has `DEFAULT_TIER = 'global'` and `ignoreChecks.js` has `TIER = 'repo'`. `defaultTier.js` merges them into a `DEFAULT_TIERS` map, which the `config setup` wizard also uses. `cli/lib/help.js` hardcodes "(local tier only)" / "(repo tier only)" in the summaries.
- **JS toggle writer**: `core/lib/utils/config/NamespacedBooleanKeyConfig.js` (`_buildUpdate`/`_newFileForKey`, used by `AutoFixAllConfig` and `MonitorIssuesConfig`) picks the target file from a hardcoded `stateKeys` list.
- **Shell toggle writers**: `_new_file_for_key` in `auto-fix-all/scripts/config_common.sh` and `monitor-issues/scripts/config_common.sh` hardcode the same list.

#902/#903 made the read side registry-driven; this issue does the same for the write side.

## Problem

Changing a key's `tiers` in `keys.json` (the point of #907) also needs CLI, core and shell changes. Otherwise a shortcut or toggle keeps writing to a tier the key no longer allows, or misses a tier it now allows, and the help text becomes wrong. A rule computed from `tiers` alone cannot express the intended defaults either. For example, "`local` if allowed" would move `auto-fix-all.ignored_check_patterns` from repo to local if #907 adds local to it, and it would break `git.email`/`git.agents.<agent>`, which deliberately default to global.

## Expected Behavior

- `keys.json` is the single source of a key's default write tier. Each entry may have an optional `default_tier`, which must be one of its `tiers`. Without it, the default is the only tier, else `local` if allowed, else the first tier.
- Every writer resolves the target tier the same way: CLI shortcuts, the `config setup` wizard, the JS toggle writer and the shell toggle writers. The resolved tier then maps to its file (local → `.claude/state/arcanum-config.json`, repo → `.claude/configuration/arcanum-repo-config.json`, global → `$CLAUDE_CONFIG_DIR/arcanum-config.json`).
- On the CLI, the user picks another tier with the existing `--global`/`--repo`/`--local` flags, validated against the registry `tiers` as today. The toggle skills and the `auto-fix-all`/`monitor-issues` `config set`/`toggle` scripts always write to the default tier; they get no tier option.
- Today's behavior doesn't change: the seeded `default_tier` values reproduce the current defaults.
- Shortcut help text that names allowed tiers is generated from the registry, not hardcoded.

## Solution

1. **Registry (shared)**: add the optional `default_tier` field to `keys.json` and to `KeyRegistry` (validated: it must be in `tiers`), with a `defaultTier(key)` helper that resolves `default_tier` → only tier → `local` if allowed → first tier. Seed it so nothing changes: `engine.mode`, `git.merge_body_mode`, `next_step.auto.<skill>` and the other keys that currently default to local → `local`; `git.email` and `git.agents.<agent>` → `global`. Single-tier keys need no field. Document the field in the settings doc and in `arcanum-cli.md`.
2. **CLI (client)**: remove `tier` from `SINGLE_VALUE`, the `DEFAULT_TIER`/`TIER` constants in `nextStep.js`, `agentsEmailRead.js` and `ignoreChecks.js`, and the `DEFAULT_TIERS` map. Shortcuts and `config setup` call the registry helper. Generate the "(… tier only)" help summaries from `tiers`. Update specs and `docs/agents/architecture/arcanum-cli.md` / the user guide.
3. **JS toggle writer (node)**: drop `stateKeys` from `NamespacedBooleanKeyConfig`, `AutoFixAllConfig` and `MonitorIssuesConfig`. `_newFileForKey`/`_buildUpdate`/`_lockFile` resolve the file from the key's registry default tier, including the global file. An unregistered key keeps today's fallback to the repo config file.
4. **Shell toggle writers (scripter)**: replace the hardcoded `case` in both `config_common.sh` `_new_file_for_key` with a `jq` lookup of the default tier in `keys.json` (the same approach as #903's readers), mapped to the tier file. Unregistered keys keep the repo config file. Keep shell and JS behavior identical, and update the shell specs.

Owners: shared (registry field/helper), client (CLI), node (JS toggle writer), scripter (shell toggle writers).

## Benefits

- Changing a key's tiers or its default tier (#907) is an edit to `keys.json` only, plus specs and docs.
- The CLI, setup wizard, JS writer and shell writer can no longer disagree about where a key is written.
- The help text always matches the registry.
