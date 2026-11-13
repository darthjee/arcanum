# Shared Plan: Review which tiers each config key may be read from

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the new `keys.json` tiers from the main plan's "New `keys.json` tiers" table, exactly as listed. Every other agent relies on them.

## Implementation Steps

### Step 1 — Edit `keys.json`

In `shared/lib/config/keys.json`:
- `git.safe_branch`, `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context`: `"tiers": ["global", "local"]`.
- `auto-fix-all.ignored_check_patterns`: `"tiers": ["repo", "local"]`, add `"default_tier": "repo"`. Without it, rule 3 of `KeyRegistry#defaultTier` would move writes (`init-claude`, `config setup` ci, `ignore-checks` shortcut) to local.
- `migrations.version`: `"tiers": ["global", "local"]`; keep `read_only: true`, and update its `description` to say it is the arcanum version the local state (local tier) or the machine-wide global migrations (global tier) was migrated to.

`validateRegistry` must still pass (no duplicate keys; `default_tier` is one of the tiers).

### Step 2 — Update the shared specs

Flip or extend the assertions that pinned the old tiers:
- `shared/spec/config/KeyRegistry_spec.js`: around lines 169–173 ("disallows git.safe_branch in the repo and global tiers") → allows local and global, still disallows repo. Lines 267–271: default tiers stay local / repo, but now via rule 3 / `default_tier`. Line ~453 ("limits git.safe_branch to the local tier" via `check('set', 'git.safe_branch', 'repo', …)`) still returns `reason: 'tier'` for repo; add a case where `global` is accepted. Add cases for `ignored_check_patterns` (local accepted, global rejected) and `migrations.version` (global/local allowed, still read-only on set).
- `shared/spec/config/keys_spec.js` line ~63 ("sets default_tier only on the email keys"): include `auto-fix-all.ignored_check_patterns`.
- `shared/spec/config/RepoConfig_spec.js`: line ~73 (safe_branch only in global is ignored) becomes "reads it from global, local still wins". Line ~147 (ignored_check_patterns only in local is ignored) becomes "local overrides repo". Keep the repo-tier safe_branch (line ~67) and the global ignored_check_patterns (line ~153) cases as "ignored".
- `shared/spec/config/ConfigChain_spec.js` (~512–523) and `RepoConfigWriter_spec.js`: check whether any case relies on the old tiers; adjust only those.
- Add a `ConfigChain` case: `auto-fix-all.clear_context: true` in global and absent locally resolves to `true` from global; an explicit local `false` still wins.

## Files to Change
- `shared/lib/config/keys.json` — new tiers, `default_tier` on `ignored_check_patterns`, `migrations.version` description.
- `shared/spec/config/KeyRegistry_spec.js`, `keys_spec.js`, `RepoConfig_spec.js`, `ConfigChain_spec.js` (and `RepoConfigWriter_spec.js` if affected) — specs for the new tiers.

## CI Checks
- `shared`: `make shared-check` (CI jobs: `shared`, `shared-node-floor`)

## Notes
- `cli/` bundles `keys.json` at build time, and `core/` reads the installed copy. Both pick the change up without code edits; their specs are handled by client and node.
- The defaults drift spec (`core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`) checks defaults, not tiers, so it should not change. node confirms.
