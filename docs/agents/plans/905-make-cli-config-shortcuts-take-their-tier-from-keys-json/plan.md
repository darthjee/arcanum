# Plan: Make CLI config shortcuts take their tier from keys.json

Issue: [905-make-cli-config-shortcuts-take-their-tier-from-keys-json.md](../../issues/905-make-cli-config-shortcuts-take-their-tier-from-keys-json.md)

## Overview

Add an optional `default_tier` to `keys.json` entries and one shared default-tier rule. All config writers then use it in place of hardcoded tiers: the CLI shortcuts, the `config setup` wizard, the native `NamespacedBooleanKeyConfig` writer and the shell `_new_file_for_key` twins. The seeded values keep today's behavior exactly, so the only change is where the decision lives. Changing a key's tiers or default (#907) then means editing `keys.json` only.

## Agents involved

- [shared](shared.md)
- [client](client.md)
- [node](node.md)
- [scripter](scripter.md)

shared goes first; client, node and scripter depend only on its contracts and can work in parallel.

## Shared contracts

- **`keys.json` field `default_tier`** (optional string). It must be one of the entry's own `tiers`. `validateRegistry` rejects an unknown tier or one missing from `tiers` (`default_tier must be one of the entry's tiers`), and `KeyRegistry`'s allowed-fields list gains it.
- **Default-tier rule**, identical in JS and shell: `default_tier` if set → the only tier when `tiers` has one → `local` if `tiers` includes it → `tiers[0]`. An unknown key has no default tier (JS `null`, shell prints nothing).
- **Seeded values** (behavior-preserving): only `git.email` and `git.agents.<agent>` get `"default_tier": "global"`. Every other key already gets today's default from the rule (multi-tier shortcut keys → `local`; `git.safe_branch`, the `auto-fix-all`/`monitor-issues` booleans → `local`; `auto-fix-all.ignored_check_patterns` → `repo`).
- **JS API (shared)**: `KeyRegistry#defaultTier(keyOrPattern) → string|null`. It accepts a concrete key (`next_step.auto.enhance-issue`) or a registry pattern (`git.agents.<agent>`), resolving through `lookup` then `lookupPattern`. `ConfigChain#tierFile(repoPath, tier) → string|null` is the public form of today's `_tierFiles` mapping: local → `<repo>/.claude/state/arcanum-config.json`, repo → `<repo>/.claude/configuration/arcanum-repo-config.json`, global → `$CLAUDE_CONFIG_DIR/arcanum-config.json`, or `null` when unresolvable.
- **Shell API (scripter)**: `key_registry_default_tier <full_key>` in `arcanum/_lib/key_registry.sh` prints `local|repo|global`, or nothing for an unknown/malformed key or a broken registry. It always exits 0 and uses the same matching as `_key_registry_lookup`.
- **Writer fallback**: a key not in the registry keeps going to the repo tier (`arcanum-repo-config.json`), in both JS and shell.
