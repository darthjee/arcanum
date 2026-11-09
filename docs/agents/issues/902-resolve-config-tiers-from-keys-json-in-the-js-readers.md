# Issue: Resolve config tiers from keys.json in the JS readers

## Description

Part of #900 (split from the original sub-issue 2).

Make the JS config readers resolve the tiers a key may be read from using `shared/lib/config/keys.json`, instead of hardcoding files or reading every tier no matter what the registry says. All JS reads then go through `ConfigChain`. Behavior for each key stays the same, because each key's declared `tiers` already matches what its reader does today.

## Problem

The registry's `tiers` describe the readers instead of driving them:

- `ConfigChain` (`shared/lib/config/ConfigChain.js`) reads all three tiers (local → repo → global) for every key, whatever `tiers` says. Only CLI writes check `tiers` (`KeyRegistry#check`).
- `RepoConfig#getSafeBranch` hardcodes `.claude/state/arcanum-config.json`, and `RepoConfig#getIgnoredCheckPatterns` hardcodes `.claude/configuration/arcanum-repo-config.json`.
- `NamespacedBooleanKeyConfig` (behind `AutoFixAllConfig` and `MonitorIssuesConfig`) picks one file per key from its own hardcoded `stateKeys` list.
- The CLI's `config get`/`config list` resolve their own winner (`cli/lib/commands/config/shared.js`, `get.js`) with no tier filter. So `arcanum config get git.safe_branch` can report a repo- or global-tier value that the runtime ignores.

Changing a key's tiers therefore means editing several readers by hand. Values in tiers a key doesn't allow are silently ignored, with no way to see that. In ward, `git.safe_branch` (repo and global config) and `auto-fix-all.clear_context`/`finish_on_empty_queue` (global config) were all ignored this way without anyone noticing.

## Expected Behavior

- `ConfigChain#read`/`#readWithSource` only consult the tiers the key's `keys.json` entry lists, and skip the others silently, without any warning.
- `ConfigChain#readTiers` still reports every tier's value, plus a new field: `{ tier, file, set, value, allowed }`. `allowed: false` means the key doesn't allow that tier.
- `/arcanum-check-config` shows a disallowed tier as `ignored: tier not allowed`, and its "resolved from" line never names one.
- `arcanum config get`/`list` resolve the same way: the resolved value skips disallowed tiers, and `--all-tiers` marks them `ignored: tier not allowed`. JSON output only gains the `allowed` field.
- `RepoConfig` and `NamespacedBooleanKeyConfig` no longer read files themselves.

### Edge cases

1. **Reads that try several keys in one call** (`AgentEmail`: `git.agents.<agent>` then `git.email`). Within each tier, a key is tried only if it allows that tier, and each tier is still fully resolved before the next. Both keys allow all three tiers today, so nothing changes now.
2. **Wildcard keys.** `read('git', 'agents.node')` builds the full key `git.agents.node`, which `KeyRegistry#lookup` matches to `git.agents.<agent>`. The same goes for `next_step.auto|clear.<skill>`.
3. **Keys missing from the registry.** In production (non-strict), an unknown key reads all three tiers, as today. Specs still catch it through `ARCANUM_STRICT_CONFIG_KEYS=1`.
4. **The listed tier order is not the precedence order.** `tiers` only filters. Resolution is always local → repo → global, whatever order `keys.json` lists the tiers in.
5. **Chain rules stay the same** (`null` falls through, `""` and `false` stop the chain), with two reader-specific notes:
   - `getSafeBranch` keeps treating an empty result as unset and returns `origin/main`.
   - `NamespacedBooleanKeyConfig` uses `hasOwnProperty` today, so an explicit `null` in the new file counts as set. Under the chain, `null` falls through to the legacy file or the default. This small behavior change is accepted, because it matches every other key.
6. **`/arcanum-check-config` with a key that isn't a leaf, or that has no entry** (e.g. `git.agents`). Its tiers aren't known, so `allowed` is left out (not `false`) and nothing is marked ignored.
7. **The global path can't be resolved** (no `CLAUDE_CONFIG_DIR` or `HOME`). That tier is skipped, as today.

### Backward compatibility

- Behavior for each key is unchanged: each key's declared `tiers` matches the file its reader uses today. Values in disallowed tiers were already ignored; now they are visible.
- Intended changes users can see: the `null` change (edge case 5), CLI `config get`/`list` no longer reporting values the runtime ignores, and the new `ignored: tier not allowed` marker.
- The legacy fallbacks stay in this issue. #904 removes them, including the dead `monitor-issues.json` fallback, and #906's migration deletes those files.

## Solution

### Approach

`ConfigChain` filters tiers itself, and its `read(repoPath, namespace, ...keys)` signature stays the same. For each tier, it looks each key up in `keys.json` and skips the tier if the key doesn't list it. This happens where it already calls `assertRegisteredConfigKey` for each key. The registry is injected through the constructor (`{ registry = new KeyRegistry() }`) so specs can pass a fake one.

- `ConfigChain` (`shared/lib/config/ConfigChain.js`): filter tiers in `readWithSource`, and add `allowed` in `readTiers`.
- `RepoConfig` (`shared/lib/config/RepoConfig.js`): `getSafeBranch` becomes `configChain.read(repoPath, 'git', 'safe_branch')`, still returning `origin/main` for empty or missing values. `getIgnoredCheckPatterns` becomes a thin wrapper and keeps its current array checks.
- `NamespacedBooleanKeyConfig` (`core/lib/utils/config/`): the new-file read goes through `ConfigChain`, while the legacy fallback read is kept for #904 to remove.
- `ArcanumCheckConfig` (`core/lib/commands/arcanum-check-config/`): render `ignored: tier not allowed`.
- CLI `config get`/`list` (`cli/lib/commands/config/shared.js`, `get.js`, `list.js`): apply the same filter and marker.
- Check every other `core/` caller that reads a registered key, and move any direct file read to `ConfigChain`.
- Update the specs, and `docs/agents/architecture/shared-state-and-configuration.md` (the key registry section) to say that `tiers` now drives JS reads.

Defaults from the registry's `default` field are a separate change and not part of this issue.

### Out of scope

- **Writes:** `NamespacedBooleanKeyConfig#_buildUpdate`, `RepoConfigWriter`, and the CLI writers. The toggle writers' target tier moved to #905.
- Shell readers (#903), legacy fallbacks (#904), the deletion migration (#906), changing any key's tiers (#907), and the settings doc pointing at `keys.json` (#909).
- `version` and `migrations.version`. These are bookkeeping that arcanum stamps, not settings, so their direct reads stay as they are.
- A full scan of all three files for disallowed or unknown keys: #914 (config doctor).

### Alternatives not chosen

- **Callers pass the tiers they allow.** This would copy `keys.json` into every caller.
- **A new `readKey('<full.dotted.key>')` API.** Every caller would have to change, and it doesn't handle reads that try several keys in one call. It could be added later as a thin wrapper.
- **A stderr warning on every read of a disallowed tier.** Skills read config many times per run from short-lived processes, so the same warning would repeat throughout the transcript.
- **Typed getters generated from `keys.json`.** Overkill for the number of keys.

### Owners

shared (`ConfigChain`, `RepoConfig`) + node (`core/` callers, check-config) + client (CLI `config get`/`list`).

### Depends on

#901 (the settings doc, describing the current behavior first).

## Benefits

- `keys.json` becomes the single source of where a JS-read key comes from, so #907's tier review can change tiers with a registry edit.
- Values set in the wrong tier stop being invisible: `/arcanum-check-config` and `arcanum config get --all-tiers` show why they have no effect.
- The CLI and the runtime agree on the resolved value.
