# Shared Plan: Make CLI config shortcuts take their tier from keys.json

Main plan: [plan.md](plan.md)

## Shared contracts

- **`keys.json` field `default_tier`** (optional string). It must be one of the entry's own `tiers`. `validateRegistry` rejects an unknown tier or one missing from `tiers` (`default_tier must be one of the entry's tiers`), and `KeyRegistry`'s allowed-fields list gains it.
- **Default-tier rule**, identical in JS and shell: `default_tier` if set → the only tier when `tiers` has one → `local` if `tiers` includes it → `tiers[0]`. An unknown key has no default tier (JS `null`, shell prints nothing).
- **Seeded values** (behavior-preserving): only `git.email` and `git.agents.<agent>` get `"default_tier": "global"`. Every other key already gets today's default from the rule (multi-tier shortcut keys → `local`; `git.safe_branch`, the `auto-fix-all`/`monitor-issues` booleans → `local`; `auto-fix-all.ignored_check_patterns` → `repo`).
- **JS API (shared)**: `KeyRegistry#defaultTier(keyOrPattern) → string|null`. It accepts a concrete key (`next_step.auto.enhance-issue`) or a registry pattern (`git.agents.<agent>`), resolving through `lookup` then `lookupPattern`. `ConfigChain#tierFile(repoPath, tier) → string|null` is the public form of today's `_tierFiles` mapping: local → `<repo>/.claude/state/arcanum-config.json`, repo → `<repo>/.claude/configuration/arcanum-repo-config.json`, global → `$CLAUDE_CONFIG_DIR/arcanum-config.json`, or `null` when unresolvable.
- **Shell API (scripter)**: `key_registry_default_tier <full_key>` in `arcanum/_lib/key_registry.sh` prints `local|repo|global`, or nothing for an unknown/malformed key or a broken registry. It always exits 0 and uses the same matching as `_key_registry_lookup`.
- **Writer fallback**: a key not in the registry keeps going to the repo tier (`arcanum-repo-config.json`), in both JS and shell.

## Implementation Steps

### Step 1 — `default_tier` in the registry

- Add `default_tier` to `KeyRegistry.js`'s allowed entry fields. Validate it in `validateRegistry`, next to `tierProblems`: a string that is one of the entry's `tiers`.
- Add `KeyRegistry#defaultTier(keyOrPattern)` implementing the rule. Move the logic out of `cli/lib/commands/config/shortcuts/defaultTier.js`, minus its `DEFAULT_TIERS` step.
- Add `"default_tier": "global"` to `git.email` and `git.agents.<agent>` in `keys.json`.
- Specs: `shared/spec/config/KeyRegistry_spec.js` (rule branches, concrete key vs pattern, unknown key → `null`, validator refusals) and `shared/spec/config/keys_spec.js` (every `default_tier` is within `tiers`).

### Step 2 — Public tier → file mapping

Expose `ConfigChain#tierFile(repoPath, tier)`, built on the existing `_tierFiles`/`_globalConfigFile` (keep those private helpers and delegate to them). Spec it in `shared/spec/config/ConfigChain_spec.js`, including the unresolvable global → `null` case.

## Files to Change

- `shared/lib/config/keys.json` — `default_tier` on the two email keys.
- `shared/lib/config/KeyRegistry.js` — field, validation, `defaultTier`.
- `shared/lib/config/ConfigChain.js` — public `tierFile`.
- `shared/spec/config/KeyRegistry_spec.js`, `keys_spec.js`, `ConfigChain_spec.js` — coverage.
- `docs/agents/architecture/config-keys.md` — document the `default_tier` field and the rule, and add a "default tier" column (or note) to the settings table.

## CI Checks

- `shared`: `yarn lint && yarn test` (CI job: `shared`, `shared-node-floor`)

## Notes

- `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` and `ShellConfigKeyScan_spec.js` may assert on the registry's shape. Run core's specs too, or warn node.
